/**
 * audit.ts · Helper centralizado de auditoría
 *
 * Usar logAudit() en cualquier server action para registrar la acción.
 * Falla silenciosamente: NUNCA bloquea la acción principal.
 */

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export type AuditSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AuditEntry {
  /** Usuario que ejecutó la acción. Null para LOGIN_FAILED de user no existente. */
  user?: {
    id?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;

  /** Negocio relacionado, si aplica. */
  businessId?: string | null;

  /** Acción ejecutada. Usar constantes de audit-actions.ts */
  action: string;

  /** Entidad afectada (Sale, MenuItem, etc.) */
  entity: string;

  /** ID de la entidad afectada, si aplica */
  entityId?: string | null;

  /** Severidad. Default: LOW */
  severity?: AuditSeverity;

  /** Resumen legible: "Canceló Pollo asado $250 (motivo: ...)" */
  summary: string;

  /** Datos estructurados adicionales */
  metadata?: Record<string, any> | null;
}

/**
 * Captura IP y User-Agent del request actual.
 * Llama sólo desde server actions o route handlers.
 * Devuelve { ipAddress, userAgent } o nulls si no se puede.
 */
async function getRequestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    // Vercel: X-Forwarded-For. Local: X-Real-IP.
    const xff = h.get("x-forwarded-for");
    const realIp = h.get("x-real-ip");
    const ipAddress = (xff ? xff.split(",")[0].trim() : null) ?? realIp ?? null;
    const userAgent = h.get("user-agent");
    return { ipAddress, userAgent: userAgent ?? null };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Registra una acción en el audit log.
 *
 * USO:
 * ```ts
 * await logAudit({
 *   user: { id: me.id, name: me.username, role: me.role },
 *   businessId: order.businessId,
 *   action: "ITEM_CANCELED",
 *   entity: "RestaurantOrderItem",
 *   entityId: item.id,
 *   severity: "HIGH",
 *   summary: `Canceló ${item.menuItem.name} (${item.qty}x)`,
 *   metadata: { reason, priceCents: item.priceCents }
 * });
 * ```
 *
 * NUNCA tira excepción. Si falla, sólo logea a console.error.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { ipAddress, userAgent } = await getRequestContext();

    // Resolver nombre del usuario: id+name preferido, fallback "Desconocido"
    const userName =
      entry.user?.name ||
      (entry.user?.id ? `usuario#${entry.user.id.slice(-6)}` : null) ||
      "Desconocido";

    await (prisma as any).auditLog.create({
      data: {
        userId: entry.user?.id ?? null,
        userName,
        userRole: entry.user?.role ?? null,
        businessId: entry.businessId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        severity: entry.severity ?? "LOW",
        summary: entry.summary,
        metadata: entry.metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err: any) {
    // El log NUNCA debe romper la acción principal.
    console.error("[audit.log] Failed to write audit entry:", err?.message ?? err);
    console.error("[audit.log] Entry attempted:", JSON.stringify(entry).slice(0, 500));
  }
}

/**
 * Versión "fire-and-forget" para acciones donde NO queremos esperar el log.
 * Útil para POST de alto volumen donde el log no debe agregar latencia.
 */
export function logAuditAsync(entry: AuditEntry): void {
  logAudit(entry).catch((err) => {
    console.error("[audit.logAsync] error:", err);
  });
}

/**
 * Helper para construir resúmenes de cambios de campos.
 * Compara objeto antes vs después y genera string + metadata.
 */
export function describeChanges(
  before: Record<string, any>,
  after: Record<string, any>,
  labelMap?: Record<string, string>
): { summary: string; metadata: Record<string, any> } {
  const changes: Array<{ field: string; before: any; after: any }> = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldVal = before[key];
    const newVal = after[key];
    if (oldVal !== newVal) {
      changes.push({ field: key, before: oldVal, after: newVal });
    }
  }

  const labels = labelMap ?? {};
  const parts = changes.map((c) => {
    const label = labels[c.field] ?? c.field;
    return `${label}: ${formatVal(c.before)} → ${formatVal(c.after)}`;
  });

  return {
    summary: parts.join(", "),
    metadata: { changes },
  };
}

function formatVal(v: any): string {
  if (v === null || v === undefined) return "(vacío)";
  if (typeof v === "string") return v.length > 30 ? `"${v.slice(0, 30)}..."` : `"${v}"`;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "sí" : "no";
  return JSON.stringify(v).slice(0, 30);
}

/**
 * Formatea cents como pesos mexicanos para summaries.
 */
export function fmtMxn(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

async function assertCanReadAudit() {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!GLOBAL_ROLES.includes(role)) {
    throw new Error("Sin permisos para consultar el historial.");
  }
  return me;
}

export interface AuditFilters {
  fromIso: string;            // ISO datetime inicio (inclusive)
  toIso: string;              // ISO datetime fin (exclusive)
  userId?: string | null;
  businessId?: string | null;
  severity?: string | null;
  action?: string | null;
  category?: string | null;   // categoría de audit-actions.ts
  search?: string | null;
}

function buildWhere(filters: AuditFilters, actionsInCategory?: string[]) {
  const where: any = {
    createdAt: {
      gte: new Date(filters.fromIso),
      lt: new Date(filters.toIso),
    },
  };
  if (filters.userId) where.userId = filters.userId;
  if (filters.businessId) where.businessId = filters.businessId;
  if (filters.severity) where.severity = filters.severity;
  if (filters.action) where.action = filters.action;
  if (actionsInCategory && actionsInCategory.length > 0) {
    where.action = { in: actionsInCategory };
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { userName: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

/**
 * KPIs principales del dashboard.
 */
export async function getAuditKpis(filters: AuditFilters, actionsInCategory?: string[]) {
  await assertCanReadAudit();
  const where = buildWhere(filters, actionsInCategory);

  const [total, byUserCount, criticalCount, highCount] = await Promise.all([
    (prisma as any).auditLog.count({ where }),
    (prisma as any).auditLog.findMany({
      where,
      distinct: ["userId"],
      select: { userId: true },
      take: 100,
    }),
    (prisma as any).auditLog.count({ where: { ...where, severity: "CRITICAL" } }),
    (prisma as any).auditLog.count({ where: { ...where, severity: "HIGH" } }),
  ]);

  return {
    totalActions: total,
    activeUsers: byUserCount.filter((u: any) => u.userId).length,
    criticalCount,
    highCount,
  };
}

/**
 * Eventos recientes (timeline).
 * Limita a `limit` (default 50) para no traer millones de filas.
 */
export async function getRecentAuditEvents(
  filters: AuditFilters,
  limit = 50,
  actionsInCategory?: string[]
) {
  await assertCanReadAudit();
  const where = buildWhere(filters, actionsInCategory);

  const events = await (prisma as any).auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });

  return events.map((e: any) => ({
    id: e.id,
    userId: e.userId,
    userName: e.userName,
    userRole: e.userRole,
    businessId: e.businessId,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    severity: e.severity,
    summary: e.summary,
    metadata: e.metadata,
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Heatmap: actividad por usuario × hora del día.
 * Devuelve filas de la forma { userId, userName, hour, count }.
 * Solo cuenta filas dentro del rango filtrado.
 */
export async function getAuditHeatmap(
  filters: AuditFilters,
  actionsInCategory?: string[]
) {
  await assertCanReadAudit();

  // SQL bruto para extraer hour() en timezone México
  const fromTs = new Date(filters.fromIso);
  const toTs = new Date(filters.toIso);

  const params: any[] = [fromTs, toTs];
  let extraFilters = "";

  if (filters.userId) { params.push(filters.userId); extraFilters += ` AND "userId" = $${params.length}`; }
  if (filters.businessId) { params.push(filters.businessId); extraFilters += ` AND "businessId" = $${params.length}`; }
  if (filters.severity) { params.push(filters.severity); extraFilters += ` AND severity = $${params.length}`; }
  if (filters.action) { params.push(filters.action); extraFilters += ` AND action = $${params.length}`; }
  if (actionsInCategory && actionsInCategory.length > 0) {
    extraFilters += ` AND action IN (${actionsInCategory.map((_, i) => `$${params.length + i + 1}`).join(", ")})`;
    params.push(...actionsInCategory);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    extraFilters += ` AND (summary ILIKE $${params.length} OR "userName" ILIKE $${params.length} OR action ILIKE $${params.length})`;
  }

  const sql = `
    SELECT
      "userId" as "userId",
      "userName" as "userName",
      EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'America/Mexico_City'))::int as hour,
      COUNT(*)::int as count
    FROM "AuditLog"
    WHERE "createdAt" >= $1 AND "createdAt" < $2
    ${extraFilters}
    GROUP BY "userId", "userName", hour
    ORDER BY "userName" ASC, hour ASC
  `;

  const rows = await (prisma as any).$queryRawUnsafe(sql, ...params);
  return rows as Array<{ userId: string | null; userName: string; hour: number; count: number }>;
}

/**
 * Resumen por usuario: total acciones, breakdown por categoría.
 */
export async function getUserActivitySummary(
  filters: AuditFilters,
  actionsInCategory?: string[]
) {
  await assertCanReadAudit();

  const where = buildWhere(filters, actionsInCategory);

  // Group by user
  const grouped = await (prisma as any).auditLog.groupBy({
    by: ["userId", "userName", "userRole"],
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 50,
  });

  // Conteo de severidades por usuario (sub-queries paralelas)
  const userIds = grouped.map((g: any) => g.userId).filter(Boolean);
  let critPerUser: any[] = [];
  let highPerUser: any[] = [];

  if (userIds.length > 0) {
    [critPerUser, highPerUser] = await Promise.all([
      (prisma as any).auditLog.groupBy({
        by: ["userId"],
        where: { ...where, severity: "CRITICAL", userId: { in: userIds } },
        _count: { id: true },
      }),
      (prisma as any).auditLog.groupBy({
        by: ["userId"],
        where: { ...where, severity: "HIGH", userId: { in: userIds } },
        _count: { id: true },
      }),
    ]);
  }

  const critMap = new Map(critPerUser.map((c: any) => [c.userId, c._count.id]));
  const highMap = new Map(highPerUser.map((h: any) => [h.userId, h._count.id]));

  return grouped.map((g: any) => ({
    userId: g.userId,
    userName: g.userName,
    userRole: g.userRole,
    totalActions: g._count.id,
    criticalCount: critMap.get(g.userId) ?? 0,
    highCount: highMap.get(g.userId) ?? 0,
  }));
}

/**
 * Lista de acciones únicas y conteo, para filtros.
 */
export async function getAuditActionStats(filters: AuditFilters) {
  await assertCanReadAudit();
  const where = buildWhere(filters);

  const grouped = await (prisma as any).auditLog.groupBy({
    by: ["action"],
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return grouped.map((g: any) => ({ action: g.action, count: g._count.id }));
}

/**
 * Alertas inteligentes basadas en patrones del log.
 * Retorna mensajes accionables para el dashboard.
 */
export async function getAuditAlerts(filters: AuditFilters) {
  await assertCanReadAudit();
  const alerts: Array<{ severity: "info" | "warning" | "danger"; title: string; detail: string; userId?: string }> = [];

  const baseWhere = buildWhere(filters);

  // 1) Usuarios con muchas cancelaciones en el periodo
  try {
    const cancelers = await (prisma as any).auditLog.groupBy({
      by: ["userId", "userName"],
      where: {
        ...baseWhere,
        action: { in: ["ORDER_ITEM_CANCELED", "ORDER_CANCELED"] },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 3 } } },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });
    for (const c of cancelers) {
      alerts.push({
        severity: "warning",
        title: `${c.userName} tiene ${c._count.id} cancelaciones`,
        detail: "Revisar motivos en detalle",
        userId: c.userId ?? undefined,
      });
    }
  } catch {}

  // 2) Eventos críticos
  try {
    const criticalCount = await (prisma as any).auditLog.count({
      where: { ...baseWhere, severity: "CRITICAL" },
    });
    if (criticalCount > 0) {
      alerts.push({
        severity: "danger",
        title: `${criticalCount} acción${criticalCount > 1 ? "es" : ""} crítica${criticalCount > 1 ? "s" : ""}`,
        detail: "Revisa cambios de rol, refunds, resets de password",
      });
    }
  } catch {}

  // 3) Logins fallidos sospechosos
  try {
    const failedLogins = await (prisma as any).auditLog.groupBy({
      by: ["userName"],
      where: { ...baseWhere, action: "LOGIN_FAILED" },
      _count: { id: true },
      having: { id: { _count: { gt: 3 } } },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    });
    for (const f of failedLogins) {
      alerts.push({
        severity: "warning",
        title: `${f.userName}: ${f._count.id} intentos de login fallidos`,
        detail: "Posible intento de acceso no autorizado",
      });
    }
  } catch {}

  return alerts;
}

/**
 * Detalle de un usuario específico para drill-down.
 */
export async function getUserAuditDetail(userId: string, filters: AuditFilters) {
  await assertCanReadAudit();

  const where = buildWhere(filters);
  where.userId = userId;

  const [events, byCategoryRaw, byBusinessRaw] = await Promise.all([
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    (prisma as any).auditLog.groupBy({
      by: ["action"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    (prisma as any).auditLog.groupBy({
      by: ["businessId"],
      where,
      _count: { id: true },
    }),
  ]);

  return {
    events: events.map((e: any) => ({
      id: e.id,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      severity: e.severity,
      summary: e.summary,
      businessId: e.businessId,
      metadata: e.metadata,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    })),
    byAction: byCategoryRaw.map((g: any) => ({ action: g.action, count: g._count.id })),
    byBusiness: byBusinessRaw.map((g: any) => ({ businessId: g.businessId, count: g._count.id })),
  };
}

/**
 * Lista usuarios para filtros (todos los que han generado logs).
 */
export async function getAuditUsers(filters: AuditFilters) {
  await assertCanReadAudit();
  const where = buildWhere(filters);

  const grouped = await (prisma as any).auditLog.groupBy({
    by: ["userId", "userName"],
    where: { ...where, userId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 100,
  });

  return grouped.map((g: any) => ({
    id: g.userId,
    name: g.userName,
    count: g._count.id,
  }));
}

"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { WithdrawalStatus, WithdrawalKind } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════════════════
   Validaciones
   ═══════════════════════════════════════════════════════════════════════════ */

async function assertManagerForBusiness(businessId: string) {
  const me = await getMe();
  if (!isManager({ role: me.role as string })) {
    throw new Error("Sin permisos para operar retiros.");
  }
  if (["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(me.role as string)) return me;
  if ((me as any).primaryBusinessId === businessId) return me;

  try {
    const access = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "UserBusinessAccess"
      WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
      LIMIT 1
    `;
    if (access.length > 0) return me;
  } catch {
    /* tabla puede no existir */
  }
  throw new Error("No tienes acceso a ese negocio.");
}

async function assertCashpointInBusiness(cashpointId: string, businessId: string) {
  const cp = await prisma.cashpoint.findUnique({
    where: { id: cashpointId },
    select: { businessId: true, name: true },
  });
  if (!cp) throw new Error("Caja no encontrada.");
  if (cp.businessId !== businessId) {
    throw new Error("La caja no pertenece al negocio indicado.");
  }
  return cp;
}

async function canApproveWithdrawals() {
  const me = await getMe();
  // Los roles con FIN_WITHDRAWALS_APPROVE según rbac.ts
  const allowedRoles = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
  return { me, allowed: allowedRoles.includes(me.role as string) };
}

function revalidateAll() {
  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");
  revalidatePath("/app/manager/withdrawals");
  revalidatePath("/app/owner/withdrawals");
}

/* ═══════════════════════════════════════════════════════════════════════════
   NUEVAS (Fase 2 — dashboard de gerentes)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Retiro de caja chica: se aprueba automáticamente para compras inmediatas.
 * La contadora lo ve en reportes después.
 */
export async function createPettyCashWithdrawal(input: {
  businessId: string;
  cashpointId: string;
  amountCents: number;
  reason: string;
}) {
  const me = await assertManagerForBusiness(input.businessId);
  await assertCashpointInBusiness(input.cashpointId, input.businessId);

  if (input.amountCents <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (!input.reason?.trim()) throw new Error("Escribe el motivo del retiro.");

  const w = await prisma.withdrawal.create({
    data: {
      businessId: input.businessId,
      cashpointId: input.cashpointId,
      amountCents: input.amountCents,
      reason: input.reason.trim(),
      kind: "PETTY_CASH",
      status: "APPROVED",
      requestedById: (me as any).id,
      approvedById: (me as any).id,
      decidedAt: new Date(),
    },
  });

  revalidateAll();
  return { ok: true, withdrawalId: w.id };
}

/**
 * Solicitud de retiro grande: queda REQUESTED hasta que la contadora
 * (o un rol con FIN_WITHDRAWALS_APPROVE) lo apruebe o rechace.
 */
export async function requestLargeWithdrawal(input: {
  businessId: string;
  cashpointId: string;
  amountCents: number;
  reason: string;
}) {
  const me = await assertManagerForBusiness(input.businessId);
  await assertCashpointInBusiness(input.cashpointId, input.businessId);

  if (input.amountCents <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (!input.reason?.trim()) throw new Error("Escribe el motivo del retiro.");

  const w = await prisma.withdrawal.create({
    data: {
      businessId: input.businessId,
      cashpointId: input.cashpointId,
      amountCents: input.amountCents,
      reason: input.reason.trim(),
      kind: "LARGE_REQUEST",
      status: "REQUESTED",
      requestedById: (me as any).id,
    },
  });

  revalidateAll();
  return { ok: true, withdrawalId: w.id };
}

/**
 * Listar cajas para un conjunto de negocios.
 */
export async function getCashpointsForBusinesses(businessIds: string[]) {
  if (businessIds.length === 0) return [];
  return prisma.cashpoint.findMany({
    where: { businessId: { in: businessIds } },
    select: { id: true, name: true, businessId: true },
    orderBy: [{ businessId: "asc" }, { name: "asc" }],
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEGADO (compatibilidad con archivos existentes)
   Mantienen los nombres que tu código ya importa:
   - createWithdrawal  (WithdrawalsClient.tsx)
   - decideWithdrawal  (WithdrawalsClient.tsx)
   - getWithdrawals    (manager/withdrawals/page.tsx, owner/withdrawals/page.tsx)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * [LEGADO] Crear retiro genérico — router a las dos funciones nuevas.
 * Si no se pasa `kind`, usa LARGE_REQUEST como default (comportamiento previo).
 * Si no se pasa `cashpointId`, intenta deducirla (toma la primera caja del negocio).
 */
export async function createWithdrawal(input: {
  businessId: string;
  amountCents: number;
  reason?: string;
  cashpointId?: string | null;
  kind?: WithdrawalKind;
}) {
  const kind: WithdrawalKind = input.kind ?? "LARGE_REQUEST";

  // Deducir cashpointId si no se pasó
  let cashpointId = input.cashpointId;
  if (!cashpointId) {
    const first = await prisma.cashpoint.findFirst({
      where: { businessId: input.businessId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    cashpointId = first?.id ?? null;
  }
  if (!cashpointId) {
    throw new Error("El negocio no tiene cajas configuradas. Crea una caja antes de registrar retiros.");
  }

  if (kind === "PETTY_CASH") {
    return createPettyCashWithdrawal({
      businessId: input.businessId,
      cashpointId,
      amountCents: input.amountCents,
      reason: input.reason ?? "Retiro de caja chica",
    });
  }
  return requestLargeWithdrawal({
    businessId: input.businessId,
    cashpointId,
    amountCents: input.amountCents,
    reason: input.reason ?? "Retiro",
  });
}

/**
 * [LEGADO] Aprobar / rechazar una solicitud de retiro.
 * Solo roles con FIN_WITHDRAWALS_APPROVE (MASTER_ADMIN, OWNER, SUPERIOR).
 */
export async function decideWithdrawal(input: {
  withdrawalId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
}) {
  const { me, allowed } = await canApproveWithdrawals();
  if (!allowed) {
    throw new Error("Sin permisos para aprobar o rechazar retiros.");
  }

  const w = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { id: true, status: true, businessId: true },
  });
  if (!w) throw new Error("Retiro no encontrado.");
  if (w.status !== "REQUESTED") {
    throw new Error(`Este retiro ya fue ${w.status === "APPROVED" ? "aprobado" : "rechazado"}.`);
  }

  const updated = await prisma.withdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      status: input.decision as WithdrawalStatus,
      approvedById: (me as any).id,
      decidedAt: new Date(),
      // Si hay nota y la razón previa estaba vacía, anexamos la nota como reason
      ...(input.note ? { reason: input.note } : {}),
    },
  });

  revalidateAll();
  return { ok: true, withdrawal: updated };
}

/**
 * [LEGADO] Listar retiros con filtros opcionales.
 * - Si el usuario es global (MASTER_ADMIN/OWNER/SUPERIOR/ACCOUNTING): ve todos.
 * - Si es gerente: solo los de sus negocios.
 */
export async function getWithdrawals(filters?: {
  businessIds?: string[];
  status?: WithdrawalStatus | WithdrawalStatus[];
  kind?: WithdrawalKind | WithdrawalKind[];
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const me = await getMe();
  const role = me.role as string;

  // Resolver scope por rol
  const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];
  let scopedBusinessIds: string[] | null = null;

  if (!GLOBAL_ROLES.includes(role)) {
    // Gerente: limitar a sus negocios
    const ids: string[] = [];
    if ((me as any).primaryBusinessId) ids.push((me as any).primaryBusinessId);
    try {
      const access = await prisma.$queryRaw<{ businessId: string }[]>`
        SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${(me as any).id}
      `;
      for (const a of access) {
        if (!ids.includes(a.businessId)) ids.push(a.businessId);
      }
    } catch {
      /* ignore */
    }
    scopedBusinessIds = ids;
  }

  // Combinar filtro del caller con scope
  let businessIdFilter: string[] | undefined;
  if (filters?.businessIds && scopedBusinessIds) {
    businessIdFilter = filters.businessIds.filter((b) => scopedBusinessIds!.includes(b));
  } else if (filters?.businessIds) {
    businessIdFilter = filters.businessIds;
  } else if (scopedBusinessIds) {
    businessIdFilter = scopedBusinessIds;
  }

  if (businessIdFilter && businessIdFilter.length === 0) return [];

  const where: any = {};
  if (businessIdFilter) where.businessId = { in: businessIdFilter };
  if (filters?.status) {
    where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
  }
  if (filters?.kind) {
    where.kind = Array.isArray(filters.kind) ? { in: filters.kind } : filters.kind;
  }
  if (filters?.from || filters?.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  return prisma.withdrawal.findMany({
    where,
    include: {
      business: { select: { id: true, name: true } },
      cashpoint: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 200,
  });
}
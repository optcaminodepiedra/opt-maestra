"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";

/* ═══════════════════════════ Validaciones ═══════════════════════════ */

async function assertManagerForBusiness(businessId: string) {
  const me = await getMe();
  if (!isManager({ role: me.role as string })) {
    throw new Error("Sin permisos para retirar.");
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

/* ═══════════════════════════ Caja chica (inmediato) ═══════════════════════════ */

/**
 * Retiro de caja chica: se aprueba automáticamente para que el gerente
 * pueda hacer una compra inmediata (ej. ir por insumos al súper).
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

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");
  revalidatePath("/app/owner/withdrawals");

  return { ok: true, withdrawalId: w.id };
}

/* ═══════════════════════════ Retiro grande (pide aprobación) ═══════════════════════════ */

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

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");
  revalidatePath("/app/owner/withdrawals");

  return { ok: true, withdrawalId: w.id };
}

/* ═══════════════════════════ Listar cajas del negocio ═══════════════════════════ */

export async function getCashpointsForBusinesses(businessIds: string[]) {
  if (businessIds.length === 0) return [];
  return prisma.cashpoint.findMany({
    where: { businessId: { in: businessIds } },
    select: { id: true, name: true, businessId: true },
    orderBy: [{ businessId: "asc" }, { name: "asc" }],
  });
}
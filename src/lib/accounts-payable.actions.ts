"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { notifyRole, notifyUser } from "@/lib/notifications.actions";

const PAY_VIEWERS = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];
const PAY_PAYERS = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];

async function assertCanView() {
  const me = await getMe();
  if (!PAY_VIEWERS.includes(me.role as string)) {
    throw new Error("Sin permisos para ver cuentas por pagar.");
  }
  return me;
}

async function assertCanPay() {
  const me = await getMe();
  if (!PAY_PAYERS.includes(me.role as string)) {
    throw new Error("Sin permisos para registrar pagos.");
  }
  return me;
}

/**
 * Crea una AccountsPayable manualmente.
 * (También se crea automáticamente desde requisitions.actions.ts)
 */
export async function createAccountsPayable(input: {
  businessId?: string | null;
  requisitionId?: string | null;
  supplierName: string;
  concept: string;
  amountCents: number;
  dueDateIso?: string | null;
  isUrgent?: boolean;
  note?: string;
}) {
  const me = await getMe();
  if (!input.supplierName.trim()) throw new Error("Falta proveedor.");
  if (!input.concept.trim()) throw new Error("Falta concepto.");
  if (input.amountCents <= 0) throw new Error("Monto inválido.");

  const ap = await prisma.accountsPayable.create({
    data: {
      businessId: input.businessId ?? null,
      requisitionId: input.requisitionId ?? null,
      supplierName: input.supplierName.trim(),
      concept: input.concept.trim(),
      amountCents: input.amountCents,
      dueDate: input.dueDateIso ? new Date(input.dueDateIso + "T00:00:00.000Z") : null,
      isUrgent: input.isUrgent ?? false,
      note: input.note?.trim() || null,
      createdById: (me as any).id,
    },
    select: { id: true, supplierName: true, concept: true, amountCents: true },
  });

  // Notificar a contabilidad
  await notifyRole({
    role: "ACCOUNTING",
    type: input.isUrgent ? "PAYMENT_DUE" : "PAYMENT_DUE",
    title: input.isUrgent ? "🚨 Pago URGENTE pendiente" : "Nueva cuenta por pagar",
    message: `${ap.supplierName} · ${ap.concept} · ${formatMoney(ap.amountCents)}`,
    linkUrl: "/app/accounting/payable",
    relatedEntityId: ap.id,
    relatedEntityType: "AccountsPayable",
  });

  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/payable");
  return { ok: true, id: ap.id };
}

/**
 * Marca una cuenta por pagar como pagada.
 */
export async function markAccountsPayablePaid(input: {
  id: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | string;
  paymentRef?: string;
  linkedExpenseId?: string;
  linkedWithdrawalId?: string;
}) {
  const me = await assertCanPay();

  const ap = await prisma.accountsPayable.findUnique({
    where: { id: input.id },
    select: { id: true, status: true, requisitionId: true, supplierName: true, amountCents: true },
  });
  if (!ap) throw new Error("Cuenta no encontrada.");
  if (ap.status === "PAID") throw new Error("Ya fue pagada.");
  if (ap.status === "CANCELED") throw new Error("Cuenta cancelada.");

  await prisma.accountsPayable.update({
    where: { id: input.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidById: (me as any).id,
      paymentMethod: input.paymentMethod,
      paymentRef: input.paymentRef ?? null,
      linkedExpenseId: input.linkedExpenseId ?? null,
      linkedWithdrawalId: input.linkedWithdrawalId ?? null,
    },
  });

  // Si está vinculada a una requisición, notificar al gerente que la pidió
  if (ap.requisitionId) {
    const req = await prisma.requisition.findUnique({
      where: { id: ap.requisitionId },
      select: { createdById: true, title: true },
    });
    if (req?.createdById) {
      await notifyUser({
        userId: req.createdById,
        type: "GENERAL",
        title: "Pago realizado",
        message: `Tu requisición "${req.title}" ya fue pagada a ${ap.supplierName}`,
        linkUrl: `/app/inventory/requisitions/${ap.requisitionId}`,
      });
    }
  }

  revalidatePath("/app/accounting/payable");
  return { ok: true };
}

/**
 * Cancela una cuenta por pagar (no se pagará).
 */
export async function cancelAccountsPayable(input: { id: string; reason?: string }) {
  await assertCanPay();
  const ap = await prisma.accountsPayable.findUnique({
    where: { id: input.id },
    select: { status: true },
  });
  if (!ap) throw new Error("Cuenta no encontrada.");
  if (ap.status === "PAID") throw new Error("No se puede cancelar una cuenta ya pagada.");

  await prisma.accountsPayable.update({
    where: { id: input.id },
    data: {
      status: "CANCELED",
      note: input.reason ? `Cancelado: ${input.reason}` : "Cancelado",
    },
  });
  revalidatePath("/app/accounting/payable");
  return { ok: true };
}

/**
 * Lista cuentas por pagar con filtros.
 */
export async function listAccountsPayable(opts?: {
  status?: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  businessId?: string;
  isUrgent?: boolean;
  limit?: number;
}) {
  await assertCanView();

  const items = await prisma.accountsPayable.findMany({
    where: {
      ...(opts?.status && { status: opts.status }),
      ...(opts?.businessId && { businessId: opts.businessId }),
      ...(opts?.isUrgent !== undefined && { isUrgent: opts.isUrgent }),
    },
    include: {
      business: { select: { name: true } },
      requisition: { select: { id: true, title: true, kind: true } },
      createdBy: { select: { fullName: true } },
      paidBy: { select: { fullName: true } },
    },
    orderBy: [
      { isUrgent: "desc" },
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
    take: opts?.limit ?? 100,
  });

  // Marcar como OVERDUE las que ya pasaron de fecha y siguen PENDING
  const now = new Date();
  const overdueIds = items
    .filter((i) => i.status === "PENDING" && i.dueDate && i.dueDate < now)
    .map((i) => i.id);

  if (overdueIds.length > 0) {
    await prisma.accountsPayable.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
    // Refrescar el status en memoria
    items.forEach((i) => {
      if (overdueIds.includes(i.id)) i.status = "OVERDUE";
    });
  }

  return items;
}

/**
 * Resumen para dashboard de contadora.
 */
export async function getAccountsPayableSummary() {
  await assertCanView();

  const [pendingAgg, overdueAgg, urgentCount, paidThisMonthAgg] = await Promise.all([
    prisma.accountsPayable.aggregate({
      where: { status: "PENDING" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.accountsPayable.aggregate({
      where: { status: "OVERDUE" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.accountsPayable.count({
      where: { status: { in: ["PENDING", "OVERDUE"] }, isUrgent: true },
    }),
    prisma.accountsPayable.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  return {
    pendingCount: pendingAgg._count,
    pendingAmountCents: pendingAgg._sum.amountCents ?? 0,
    overdueCount: overdueAgg._count,
    overdueAmountCents: overdueAgg._sum.amountCents ?? 0,
    urgentCount,
    paidThisMonthCount: paidThisMonthAgg._count,
    paidThisMonthAmountCents: paidThisMonthAgg._sum.amountCents ?? 0,
  };
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}

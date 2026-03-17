"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { WithdrawalStatus } from "@prisma/client";

type CreateWithdrawalInput = {
  businessId: string;
  amount: number; // MXN
  reason?: string | null;
  requestedById: string;
};

type DecideWithdrawalInput = {
  withdrawalId: string;
  status: "APPROVED" | "REJECTED";
  approvedById: string;
};

function mxnToCents(amount: number) {
  const n = Number(amount ?? 0);
  return Math.round(n * 100);
}

export async function getWithdrawals(params: {
  businessId?: string | null;
  limit?: number;
}) {
  const limit = params.limit ?? 200;

  return prisma.withdrawal.findMany({
    where: params.businessId ? { businessId: params.businessId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      business: true,
      requestedBy: true,
      approvedBy: true,
    },
  });
}

export async function createWithdrawal(input: CreateWithdrawalInput) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.requestedById) throw new Error("Falta requestedById");

  const cents = mxnToCents(input.amount);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("Monto inválido");

  const w = await prisma.withdrawal.create({
    data: {
      businessId: input.businessId,
      amountCents: cents,
      reason: input.reason?.trim() || null,
      status: WithdrawalStatus.REQUESTED,
      requestedById: input.requestedById,
      approvedById: null,
      decidedAt: null,
    },
  });

  revalidatePath("/app/owner/withdrawals");
  revalidatePath("/app/manager/withdrawals");
  revalidatePath("/app/ops/withdrawals");

  return w.id;
}

export async function decideWithdrawal(input: DecideWithdrawalInput) {
  if (!input.withdrawalId) throw new Error("Falta withdrawalId");
  if (!input.approvedById) throw new Error("Falta approvedById");

  const nextStatus =
    input.status === "APPROVED"
      ? WithdrawalStatus.APPROVED
      : WithdrawalStatus.REJECTED;

  await prisma.withdrawal.update({
    where: { id: input.withdrawalId },
    data: {
      status: nextStatus,
      approvedById: input.approvedById,
      decidedAt: new Date(),
    },
  });

  revalidatePath("/app/owner/withdrawals");
  revalidatePath("/app/manager/withdrawals");
  revalidatePath("/app/ops/withdrawals");
}

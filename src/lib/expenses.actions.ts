"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createExpense(input: {
  businessId: string;
  userId: string;
  amount: number; // MXN
  category: string;
  note?: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.userId) throw new Error("Falta userId");
  if (!input.category?.trim()) throw new Error("Falta categoría");

  const amt = Number(input.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Monto inválido");

  const amountCents = Math.round(amt * 100);

  await prisma.expense.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      amountCents,
      category: input.category.trim(),
      note: input.note?.trim() || null,
    },
  });

  // revalidaciones generales
  revalidatePath("/app/owner");
  revalidatePath("/app/owner/expenses");
  revalidatePath("/app/manager/expenses");
}

/**
 * Lista de gastos recientes para dashboards/listados.
 * - Si pasas businessId, filtra por unidad.
 * - Si pasas userId, filtra por quien lo registró.
 */
export async function getRecentExpenses(params?: {
  businessId?: string;
  userId?: string;
  take?: number;
}) {
  const take = params?.take ?? 50;

  return prisma.expense.findMany({
    where: {
      ...(params?.businessId ? { businessId: params.businessId } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      business: true,
      user: true,
    },
  });
}

/**
 * Alias por compatibilidad con tu /owner/expenses/page.tsx
 * (tu página ya lo está importando con este nombre).
 */
export async function getManagerRecentExpenses() {
  return getRecentExpenses({ take: 80 });
}

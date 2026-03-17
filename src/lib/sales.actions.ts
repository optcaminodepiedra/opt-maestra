"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PaymentMethod } from "@prisma/client";

type CreateSaleInput = {
  businessId: string;
  cashpointId: string;
  userId: string;
  amount: number; // pesos
  method: PaymentMethod;
  concept: string;
  shiftId?: string | null;
};

export async function getSalesForOwner(params?: {
  take?: number;
  businessId?: string;
}) {
  const take = params?.take ?? 100;

  return prisma.sale.findMany({
    where: params?.businessId ? { businessId: params.businessId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      business: true,
      cashpoint: true,
      user: true,
    },
  });
}

export async function getSalesFormData() {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    include: { cashpoints: { orderBy: { name: "asc" } } },
  });

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });

  return { businesses, users };
}

export async function createSale(input: CreateSaleInput) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.cashpointId) throw new Error("Falta caja");
  if (!input.userId) throw new Error("Falta usuario");
  if (!input.concept?.trim()) throw new Error("Falta concepto");

  const amountCents = Math.round((input.amount || 0) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Monto inválido");
  }

  await prisma.sale.create({
    data: {
      businessId: input.businessId,
      cashpointId: input.cashpointId,
      userId: input.userId,
      shiftId: input.shiftId || null,
      amountCents,
      method: input.method,
      concept: input.concept.trim(),
    },
  });

  // refresca rutas típicas
  revalidatePath("/app/owner");
  revalidatePath("/app/owner/sales");
  return true;
}

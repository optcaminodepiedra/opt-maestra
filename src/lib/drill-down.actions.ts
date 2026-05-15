"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveManagerScope } from "@/lib/manager-scope";

type Filters = {
  fromIso: string;       // ISO datetime
  toIso: string;
  businessIds?: string[];
  method?: "CASH" | "CARD" | "TRANSFER";
  category?: string;
  limit?: number;
};

export async function loadSalesDrillDown(filters: Filters) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("No autorizado");

  const scope = await resolveManagerScope();
  const allowedBiz = scope.businessIds;

  // Si pasan businessIds, filtrar a la intersección
  let bizFilter: string[];
  if (filters.businessIds && filters.businessIds.length > 0) {
    bizFilter = filters.businessIds.filter((id) => allowedBiz.includes(id));
  } else {
    bizFilter = allowedBiz;
  }

  if (bizFilter.length === 0) return [];

  const from = new Date(filters.fromIso);
  const to = new Date(filters.toIso);

  const sales = await prisma.sale.findMany({
    where: {
      businessId: { in: bizFilter },
      createdAt: { gte: from, lt: to },
      ...(filters.method ? { method: filters.method } : {}),
    },
    include: {
      business: { select: { name: true } },
      user: { select: { fullName: true } },
      cashpoint: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
  });

  return sales.map((s) => ({
    id: s.id,
    amountCents: s.amountCents,
    method: s.method,
    concept: s.concept,
    createdAt: s.createdAt.toISOString(),
    businessName: s.business.name,
    userName: s.user.fullName,
    cashpointName: s.cashpoint.name,
  }));
}

export async function loadExpensesDrillDown(filters: Filters) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("No autorizado");

  const scope = await resolveManagerScope();
  const allowedBiz = scope.businessIds;

  let bizFilter: string[];
  if (filters.businessIds && filters.businessIds.length > 0) {
    bizFilter = filters.businessIds.filter((id) => allowedBiz.includes(id));
  } else {
    bizFilter = allowedBiz;
  }

  if (bizFilter.length === 0) return [];

  const from = new Date(filters.fromIso);
  const to = new Date(filters.toIso);

  const expenses = await prisma.expense.findMany({
    where: {
      businessId: { in: bizFilter },
      createdAt: { gte: from, lt: to },
      ...(filters.category ? { category: filters.category } : {}),
    },
    include: {
      business: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
  });

  return expenses.map((e) => ({
    id: e.id,
    amountCents: e.amountCents,
    category: e.category,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    businessName: e.business.name,
    userName: e.user.fullName,
  }));
}

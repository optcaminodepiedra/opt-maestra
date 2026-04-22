import { prisma } from "@/lib/prisma";
import type { ManagerScope } from "@/lib/manager-scope";

export async function loadManagerReports(
  scope: ManagerScope,
  year: number,
  month: number, // 1-12
  selectedBusinessId?: string | null
) {
  const businessIds = selectedBusinessId ? [selectedBusinessId] : scope.businessIds;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1); // primer día del siguiente mes

  const [sales, expenses, withdrawals, businesses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId: { in: businessIds },
        createdAt: { gte: from, lt: to },
      },
      select: {
        amountCents: true,
        createdAt: true,
        businessId: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        businessId: { in: businessIds },
        createdAt: { gte: from, lt: to },
      },
      select: {
        amountCents: true,
        createdAt: true,
        businessId: true,
      },
    }),
    prisma.withdrawal.findMany({
      where: {
        businessId: { in: businessIds },
        status: "APPROVED",
        createdAt: { gte: from, lt: to },
      },
      select: {
        amountCents: true,
        createdAt: true,
        businessId: true,
      },
    }),
    prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true },
    }),
  ]);

  // Agregado por negocio
  const businessMap = new Map(businesses.map((b) => [b.id, b.name]));
  const monthlyByBiz: Record<string, {
    businessId: string;
    businessName: string;
    salesCents: number;
    salesCount: number;
    expensesCents: number;
    withdrawalsCents: number;
    netCents: number;
  }> = {};

  for (const bid of businessIds) {
    monthlyByBiz[bid] = {
      businessId: bid,
      businessName: businessMap.get(bid) ?? "Negocio",
      salesCents: 0,
      salesCount: 0,
      expensesCents: 0,
      withdrawalsCents: 0,
      netCents: 0,
    };
  }

  for (const s of sales) {
    if (!monthlyByBiz[s.businessId]) continue;
    monthlyByBiz[s.businessId].salesCents += s.amountCents;
    monthlyByBiz[s.businessId].salesCount++;
  }
  for (const e of expenses) {
    if (!monthlyByBiz[e.businessId]) continue;
    monthlyByBiz[e.businessId].expensesCents += e.amountCents;
  }
  for (const w of withdrawals) {
    if (!monthlyByBiz[w.businessId]) continue;
    monthlyByBiz[w.businessId].withdrawalsCents += w.amountCents;
  }
  for (const bid of businessIds) {
    const r = monthlyByBiz[bid];
    r.netCents = r.salesCents - r.expensesCents - r.withdrawalsCents;
  }

  // Agregado por día
  const dailyMap: Record<string, { dateIso: string; salesCents: number; salesCount: number; expensesCents: number }> = {};
  for (const s of sales) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[key]) dailyMap[key] = { dateIso: key, salesCents: 0, salesCount: 0, expensesCents: 0 };
    dailyMap[key].salesCents += s.amountCents;
    dailyMap[key].salesCount++;
  }
  for (const e of expenses) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[key]) dailyMap[key] = { dateIso: key, salesCents: 0, salesCount: 0, expensesCents: 0 };
    dailyMap[key].expensesCents += e.amountCents;
  }

  const daily = Object.values(dailyMap).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const monthly = Object.values(monthlyByBiz).sort((a, b) => b.salesCents - a.salesCents);

  return { monthly, daily };
}

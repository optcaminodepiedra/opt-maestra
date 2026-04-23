import { prisma } from "@/lib/prisma";

export type GlobalReportData = {
  totalSalesCents: number;
  totalSalesCount: number;
  totalExpensesCents: number;
  totalWithdrawalsCents: number;
  netCents: number;
  byBusiness: Array<{
    businessId: string;
    businessName: string;
    salesCents: number;
    salesCount: number;
    expensesCents: number;
    withdrawalsCents: number;
    netCents: number;
    pctOfTotal: number;
  }>;
  byMethod: { CASH: number; CARD: number; TRANSFER: number };
  byDay: Array<{
    dateIso: string;
    salesCents: number;
    salesCount: number;
    expensesCents: number;
  }>;
  topExpenseCategories: Array<{ category: string; cents: number; count: number }>;
};

export async function loadGlobalReport(
  year: number,
  month: number // 1-12
): Promise<GlobalReportData> {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const [sales, expenses, withdrawals, businesses] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { amountCents: true, method: true, createdAt: true, businessId: true },
    }),
    prisma.expense.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { amountCents: true, category: true, createdAt: true, businessId: true },
    }),
    prisma.withdrawal.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: from, lt: to },
      },
      select: { amountCents: true, businessId: true },
    }),
    prisma.business.findMany({ select: { id: true, name: true } }),
  ]);

  const bizMap = new Map(businesses.map((b) => [b.id, b.name]));

  // Totales
  const totalSalesCents = sales.reduce((s, x) => s + x.amountCents, 0);
  const totalSalesCount = sales.length;
  const totalExpensesCents = expenses.reduce((s, x) => s + x.amountCents, 0);
  const totalWithdrawalsCents = withdrawals.reduce((s, x) => s + x.amountCents, 0);
  const netCents = totalSalesCents - totalExpensesCents - totalWithdrawalsCents;

  // Por negocio
  const byBizMap = new Map<
    string,
    { salesCents: number; salesCount: number; expensesCents: number; withdrawalsCents: number }
  >();
  for (const b of businesses) {
    byBizMap.set(b.id, { salesCents: 0, salesCount: 0, expensesCents: 0, withdrawalsCents: 0 });
  }
  for (const s of sales) {
    const entry = byBizMap.get(s.businessId);
    if (entry) { entry.salesCents += s.amountCents; entry.salesCount++; }
  }
  for (const e of expenses) {
    const entry = byBizMap.get(e.businessId);
    if (entry) entry.expensesCents += e.amountCents;
  }
  for (const w of withdrawals) {
    const entry = byBizMap.get(w.businessId);
    if (entry) entry.withdrawalsCents += w.amountCents;
  }

  const byBusiness = Array.from(byBizMap.entries())
    .map(([businessId, data]) => {
      const net = data.salesCents - data.expensesCents - data.withdrawalsCents;
      return {
        businessId,
        businessName: bizMap.get(businessId) ?? "—",
        ...data,
        netCents: net,
        pctOfTotal: totalSalesCents > 0 ? (data.salesCents / totalSalesCents) * 100 : 0,
      };
    })
    .filter((b) => b.salesCents > 0 || b.expensesCents > 0 || b.withdrawalsCents > 0)
    .sort((a, b) => b.salesCents - a.salesCents);

  // Por método
  const byMethod = { CASH: 0, CARD: 0, TRANSFER: 0 };
  for (const s of sales) byMethod[s.method] += s.amountCents;

  // Por día
  const byDayMap = new Map<string, { salesCents: number; salesCount: number; expensesCents: number }>();
  for (const s of sales) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (!byDayMap.has(key)) byDayMap.set(key, { salesCents: 0, salesCount: 0, expensesCents: 0 });
    const row = byDayMap.get(key)!;
    row.salesCents += s.amountCents;
    row.salesCount++;
  }
  for (const e of expenses) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (!byDayMap.has(key)) byDayMap.set(key, { salesCents: 0, salesCount: 0, expensesCents: 0 });
    byDayMap.get(key)!.expensesCents += e.amountCents;
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([dateIso, v]) => ({ dateIso, ...v }))
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // Top categorías de gasto
  const catMap = new Map<string, { cents: number; count: number }>();
  for (const e of expenses) {
    const k = e.category || "Sin categoría";
    if (!catMap.has(k)) catMap.set(k, { cents: 0, count: 0 });
    const r = catMap.get(k)!;
    r.cents += e.amountCents;
    r.count++;
  }
  const topExpenseCategories = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 10);

  return {
    totalSalesCents,
    totalSalesCount,
    totalExpensesCents,
    totalWithdrawalsCents,
    netCents,
    byBusiness,
    byMethod,
    byDay,
    topExpenseCategories,
  };
}

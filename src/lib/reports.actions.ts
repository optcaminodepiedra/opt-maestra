"use server";

import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";

export type ReportsRangeKey = "7d" | "30d" | "month" | "ytd";

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfMonthLocal(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfYearLocal(d: Date) {
  const x = new Date(d.getFullYear(), 0, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeToDates(range: ReportsRangeKey) {
  const now = new Date();
  const end = endOfDayLocal(now);

  if (range === "7d") {
    const start = startOfDayLocal(addDays(now, -6));
    return { start, end };
  }
  if (range === "30d") {
    const start = startOfDayLocal(addDays(now, -29));
    return { start, end };
  }
  if (range === "month") {
    const start = startOfMonthLocal(now);
    return { start, end };
  }
  // ytd
  const start = startOfYearLocal(now);
  return { start, end };
}

function centsToMx(n: number) {
  return n / 100;
}
function safeSumCents(list: Array<{ amountCents: number }>) {
  return list.reduce((s, x) => s + (x.amountCents ?? 0), 0);
}

export async function getReportsOverview(params: {
  range: ReportsRangeKey;
  businessId?: string | null; // opcional: filtra por unidad
}) {
  const { start, end } = rangeToDates(params.range);

  const whereBiz = params.businessId ? { businessId: params.businessId } : undefined;

  const [sales, expenses, withdrawals, businesses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...(whereBiz ?? {}),
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, amountCents: true, method: true, createdAt: true, businessId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        ...(whereBiz ?? {}),
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, amountCents: true, category: true, createdAt: true, businessId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.withdrawal.findMany({
      where: {
        ...(whereBiz ?? {}),
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, amountCents: true, status: true, createdAt: true, businessId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.business.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const bizNameById = new Map(businesses.map((b) => [b.id, b.name]));

  // ===== Totales
  const salesCents = safeSumCents(sales);
  const expensesCents = safeSumCents(expenses);
  const withdrawalsCents = safeSumCents(withdrawals);
  const netCents = salesCents - expensesCents - withdrawalsCents;

  // ===== Serie diaria (ventas, gastos, retiros, neto)
  const dayMap = new Map<
    string,
    { date: string; salesCents: number; expensesCents: number; withdrawalsCents: number; netCents: number }
  >();

  function keyDayLocal(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    // yyyy-mm-dd
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const da = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  // pre-fill todos los días del rango (para que la gráfica no “brinque”)
  {
    const cursor = startOfDayLocal(start);
    const last = startOfDayLocal(end);
    let c = new Date(cursor);
    while (c <= last) {
      const k = keyDayLocal(c);
      dayMap.set(k, { date: k, salesCents: 0, expensesCents: 0, withdrawalsCents: 0, netCents: 0 });
      c = addDays(c, 1);
    }
  }

  for (const s of sales) {
    const k = keyDayLocal(s.createdAt);
    const row = dayMap.get(k);
    if (row) row.salesCents += s.amountCents ?? 0;
  }
  for (const e of expenses) {
    const k = keyDayLocal(e.createdAt);
    const row = dayMap.get(k);
    if (row) row.expensesCents += e.amountCents ?? 0;
  }
  for (const w of withdrawals) {
    const k = keyDayLocal(w.createdAt);
    const row = dayMap.get(k);
    if (row) row.withdrawalsCents += w.amountCents ?? 0;
  }

  for (const row of dayMap.values()) {
    row.netCents = row.salesCents - row.expensesCents - row.withdrawalsCents;
  }

  const dailySeries = Array.from(dayMap.values()).map((r) => ({
    date: r.date,
    sales: centsToMx(r.salesCents),
    expenses: centsToMx(r.expensesCents),
    withdrawals: centsToMx(r.withdrawalsCents),
    net: centsToMx(r.netCents),
  }));

  // ===== Métodos de pago (donut)
  const byMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    CARD: 0,
    TRANSFER: 0,
  };
  for (const s of sales) {
    byMethod[s.method] += s.amountCents ?? 0;
  }
  const paymentBreakdown = [
    { key: "CASH", label: "Efectivo", value: centsToMx(byMethod.CASH) },
    { key: "CARD", label: "Tarjeta", value: centsToMx(byMethod.CARD) },
    { key: "TRANSFER", label: "Transfer", value: centsToMx(byMethod.TRANSFER) },
  ];

  // ===== Top unidades por ventas (bar)
  const byBiz = new Map<string, { id: string; name: string; salesCents: number; expensesCents: number; netCents: number }>();
  for (const b of businesses) {
    byBiz.set(b.id, { id: b.id, name: b.name, salesCents: 0, expensesCents: 0, netCents: 0 });
  }
  for (const s of sales) {
    const row = byBiz.get(s.businessId);
    if (row) row.salesCents += s.amountCents ?? 0;
  }
  for (const e of expenses) {
    const row = byBiz.get(e.businessId);
    if (row) row.expensesCents += e.amountCents ?? 0;
  }
  for (const w of withdrawals) {
    const row = byBiz.get(w.businessId);
    if (row) row.netCents -= w.amountCents ?? 0; // restamos retiros al neto
  }
  // net = ventas - gastos - retiros
  for (const row of byBiz.values()) {
    row.netCents = row.salesCents - row.expensesCents + row.netCents;
  }

  const topBusinesses = Array.from(byBiz.values())
    .sort((a, b) => b.salesCents - a.salesCents)
    .slice(0, 10)
    .map((x) => ({
      id: x.id,
      name: x.name,
      sales: centsToMx(x.salesCents),
      expenses: centsToMx(x.expensesCents),
      net: centsToMx(x.netCents),
    }));

  // ===== Resumen de gastos por categoría (top 8)
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.category || "Sin categoría";
    byCat.set(cat, (byCat.get(cat) ?? 0) + (e.amountCents ?? 0));
  }
  const topExpenseCategories = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, cents]) => ({ category, value: centsToMx(cents) }));

  return {
    range: params.range,
    dateStart: start.toISOString(),
    dateEnd: end.toISOString(),
    businesses, // para el filtro
    totals: {
      sales: centsToMx(salesCents),
      expenses: centsToMx(expensesCents),
      withdrawals: centsToMx(withdrawalsCents),
      net: centsToMx(netCents),
      salesCount: sales.length,
      expensesCount: expenses.length,
      withdrawalsCount: withdrawals.length,
    },
    dailySeries,
    paymentBreakdown,
    topBusinesses,
    topExpenseCategories,
    selectedBusiness: params.businessId ? { id: params.businessId, name: bizNameById.get(params.businessId) ?? "—" } : null,
  };
}

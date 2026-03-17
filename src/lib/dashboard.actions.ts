"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType } from "@prisma/client";

type RangeKey = "today" | "yesterday" | "7d" | "month";

function rangeFromKey(key: RangeKey) {
  const now = new Date();

  const start = new Date(now);
  const end = new Date(now);

  if (key === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (key === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (key === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // month = mes actual
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function money(cents: number) {
  return cents / 100;
}

function dayKey(d: Date) {
  // YYYY-MM-DD local
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export async function getOwnerExecutiveDashboard(range: RangeKey) {
  const { start, end } = rangeFromKey(range);

  // Negocios
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const businessIds = businesses.map((b) => b.id);

  // Ventas / Gastos / Retiros en rango (traemos lo necesario y agregamos en JS)
  const [sales, expenses, withdrawals] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId: { in: businessIds }, createdAt: { gte: start, lte: end } },
      select: { amountCents: true, createdAt: true, businessId: true, method: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      where: { businessId: { in: businessIds }, createdAt: { gte: start, lte: end } },
      select: { amountCents: true, createdAt: true, businessId: true, category: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.withdrawal.findMany({
      where: { businessId: { in: businessIds }, createdAt: { gte: start, lte: end } },
      select: { amountCents: true, createdAt: true, businessId: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Totales
  const totalSalesCents = sales.reduce((s, x) => s + x.amountCents, 0);
  const totalExpensesCents = expenses.reduce((s, x) => s + x.amountCents, 0);
  const totalWithdrawalsCents = withdrawals.reduce((s, x) => s + x.amountCents, 0);

  const totals = {
    sales: money(totalSalesCents),
    expenses: money(totalExpensesCents),
    withdrawals: money(totalWithdrawalsCents),
    net: money(totalSalesCents - totalExpensesCents - totalWithdrawalsCents),
  };

  // Por negocio (para barra)
  const byBusiness = businesses.map((b) => {
    const s = sales.filter((x) => x.businessId === b.id).reduce((sum, x) => sum + x.amountCents, 0);
    const e = expenses.filter((x) => x.businessId === b.id).reduce((sum, x) => sum + x.amountCents, 0);
    const w = withdrawals.filter((x) => x.businessId === b.id).reduce((sum, x) => sum + x.amountCents, 0);
    return {
      id: b.id,
      name: b.name,
      sales: money(s),
      expenses: money(e),
      withdrawals: money(w),
      net: money(s - e - w),
    };
  });

  // Serie diaria (ventas netas por día): last 7d si range=7d, si no, serie dentro del rango
  const dayMap = new Map<string, { day: string; salesCents: number; expensesCents: number; withdrawalsCents: number }>();

  for (const x of sales) {
    const k = dayKey(x.createdAt);
    const row = dayMap.get(k) || { day: k, salesCents: 0, expensesCents: 0, withdrawalsCents: 0 };
    row.salesCents += x.amountCents;
    dayMap.set(k, row);
  }
  for (const x of expenses) {
    const k = dayKey(x.createdAt);
    const row = dayMap.get(k) || { day: k, salesCents: 0, expensesCents: 0, withdrawalsCents: 0 };
    row.expensesCents += x.amountCents;
    dayMap.set(k, row);
  }
  for (const x of withdrawals) {
    const k = dayKey(x.createdAt);
    const row = dayMap.get(k) || { day: k, salesCents: 0, expensesCents: 0, withdrawalsCents: 0 };
    row.withdrawalsCents += x.amountCents;
    dayMap.set(k, row);
  }

  const seriesDaily = Array.from(dayMap.values())
    .sort((a, b) => (a.day < b.day ? -1 : 1))
    .map((d) => ({
      day: d.day,
      sales: money(d.salesCents),
      expenses: money(d.expensesCents),
      withdrawals: money(d.withdrawalsCents),
      net: money(d.salesCents - d.expensesCents - d.withdrawalsCents),
    }));

  // Métodos de pago (para pastel/mini tabla)
  const pay = {
    CASH: 0,
    CARD: 0,
    TRANSFER: 0,
  } as Record<string, number>;

  for (const s of sales) {
    pay[s.method] = (pay[s.method] || 0) + s.amountCents;
  }

  const payBreakdown = Object.entries(pay).map(([method, cents]) => ({
    method,
    amount: money(cents),
  }));

  // Kanban resumen
  const [activityCounts, ticketCounts] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { type: TaskType.ACTIVITY },
      _count: { status: true },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { type: TaskType.TICKET },
      _count: { status: true },
    }),
  ]);

  function statusObj(rows: Array<{ status: TaskStatus; _count: { status: number } }>) {
    const base = { TODO: 0, DOING: 0, BLOCKED: 0, DONE: 0 };
    for (const r of rows) base[r.status] = r._count.status;
    return base;
  }

  const kanban = {
    activities: statusObj(activityCounts as any),
    tickets: statusObj(ticketCounts as any),
    latest: await prisma.task.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { assigned: true, business: true },
    }),
  };

  // Inventario alertas (low stock) + requisiciones abiertas
  const [lowStock, submittedReqs] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: [{ businessId: "asc" }, { name: "asc" }],
      take: 30,
      include: { business: true },
    }),
    prisma.requisition.findMany({
      where: { status: { in: ["SUBMITTED", "APPROVED", "ORDERED", "RECEIVED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { business: true, createdBy: true, items: { include: { item: true } } },
    }),
  ]);

  const lowStockFiltered = lowStock
    .filter((i) => (i.onHandQty ?? 0) <= (i.minQty ?? 0))
    .slice(0, 12)
    .map((i) => ({
      id: i.id,
      name: i.name,
      onHandQty: i.onHandQty,
      minQty: i.minQty,
      business: i.business?.name ?? "—",
    }));

  // Restaurante: órdenes abiertas + items KDS pendientes (si hay data)
  const [openOrdersCount, kdsPendingCount] = await Promise.all([
    prisma.restaurantOrder.count({
      where: { status: { in: ["OPEN", "SENT", "SERVED"] } },
    }),
    prisma.restaurantOrderItem.count({
      where: {
        kitchenStatus: { in: ["NEW", "PREPARING", "READY"] },
        order: { status: { in: ["OPEN", "SENT", "SERVED"] } },
      },
    }),
  ]);

  const apps = {
    restaurant: { openOrdersCount, kdsPendingCount },
    hotel: { occupancy: null as any, arrivalsToday: null as any }, // placeholder
    museums: { entriesToday: null as any }, // placeholder
    adventure: { activeRides: null as any }, // placeholder
  };

  return {
    range,
    start,
    end,
    businesses,
    totals,
    byBusiness,
    seriesDaily,
    payBreakdown,
    kanban,
    alerts: {
      lowStock: lowStockFiltered,
      requisitions: submittedReqs.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        business: r.business?.name ?? "—",
        createdBy: r.createdBy?.fullName ?? "—",
        itemsCount: r.items?.length ?? 0,
        createdAt: r.createdAt,
      })),
    },
    apps,
  };
}

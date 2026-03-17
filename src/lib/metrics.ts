import { prisma } from "@/lib/prisma";

type RangeKey = "today" | "yesterday" | "7d" | "month";

// ✅ rango "hoy" en hora local (evita el desfase de UTC)
function todayRangeLocal() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// ✅ rangos en hora local
function rangeLocal(range: RangeKey) {
  const now = new Date();

  if (range === "today") return todayRangeLocal();

  if (range === "yesterday") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (range === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * ✅ NUEVA: métricas por negocio con rango
 */
export async function getMetricsByBusiness(range: RangeKey = "today") {
  const { start, end } = rangeLocal(range);

  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    include: {
      sales: { where: { createdAt: { gte: start, lte: end } } },
      expenses: { where: { createdAt: { gte: start, lte: end } } },
      withdrawals: { where: { createdAt: { gte: start, lte: end } } },
    },
  });

  return businesses.map((b) => {
    const salesCents = b.sales.reduce((sum, s) => sum + s.amountCents, 0);
    const expensesCents = b.expenses.reduce((sum, e) => sum + e.amountCents, 0);
    const withdrawalsCents = b.withdrawals.reduce((sum, w) => sum + w.amountCents, 0);

    return {
      id: b.id,
      name: b.name,
      sales: salesCents / 100,
      expenses: expensesCents / 100,
      withdrawals: withdrawalsCents / 100,
      net: (salesCents - expensesCents - withdrawalsCents) / 100,
    };
  });
}

/**
 * ✅ COMPAT: tu función original (hoy)
 */
export async function getTodayMetricsByBusiness() {
  return getMetricsByBusiness("today");
}

/**
 * ✅ NUEVA: detalle por negocio con rango
 */
export async function getBusinessDetail(businessId: string, range: RangeKey = "today") {
  if (!businessId) return null;

  const { start, end } = rangeLocal(range);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      sales: {
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true, cashpoint: true },
      },
      expenses: {
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      },
      withdrawals: {
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 50,
        // ✅ Withdrawal NO tiene user; usa lo que Prisma te mostró
        include: { requestedBy: true, approvedBy: true },
      },
    },
  });

  if (!business) return null;

  const salesCents = business.sales.reduce((sum, s) => sum + s.amountCents, 0);
  const expensesCents = business.expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const withdrawalsCents = business.withdrawals.reduce((sum, w) => sum + w.amountCents, 0);

  return {
    id: business.id,
    name: business.name,
    salesTotal: salesCents / 100,
    expensesTotal: expensesCents / 100,
    withdrawalsTotal: withdrawalsCents / 100,
    net: (salesCents - expensesCents - withdrawalsCents) / 100,

    sales: business.sales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      amount: s.amountCents / 100,
      method: s.method,
      concept: s.concept,
      user: s.user?.fullName ?? "—",
      cashpoint: s.cashpoint?.name ?? "—",
    })),

    expenses: business.expenses.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      amount: e.amountCents / 100,
      category: e.category,
      note: e.note ?? "",
      user: e.user?.fullName ?? "—",
    })),

    withdrawals: business.withdrawals.map((w) => ({
      id: w.id,
      createdAt: w.createdAt,
      amount: w.amountCents / 100,
      // por si tu modelo no tiene note:
      note: (w as any).note ?? "",
      user: w.requestedBy?.fullName ?? w.approvedBy?.fullName ?? "—",
    })),
  };
}

/**
 * ✅ COMPAT: tu función original (hoy)
 */
export async function getBusinessTodayDetail(businessId: string) {
  return getBusinessDetail(businessId, "today");
}

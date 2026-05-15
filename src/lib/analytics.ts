import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { DateRange } from "@/lib/date-presets";
import { formatDateForChart } from "@/lib/date-presets";

/* ═══════════════════════════════════════════════════════════════
 * TIPOS
 * ═══════════════════════════════════════════════════════════════ */

export type AnalyticsKpis = {
  salesTotal: number;
  salesCount: number;
  expensesTotal: number;
  withdrawalsTotal: number;
  netTotal: number;
  avgTicket: number;
};

export type AnalyticsKpisWithDelta = AnalyticsKpis & {
  salesDelta: number | null;
  expensesDelta: number | null;
  netDelta: number | null;
  avgTicketDelta: number | null;
};

export type TimeSeriesPoint = {
  date: string;
  label: string;
  value: number;
  count?: number;
};

export type DistributionItem = {
  key: string;
  label: string;
  value: number;
  pct: number;
  count?: number;
};

export type BusinessAnalyticsRow = {
  businessId: string;
  businessName: string;
  salesTotal: number;
  salesCount: number;
  expensesTotal: number;
  netTotal: number;
};

/* ═══════════════════════════════════════════════════════════════
 * KPIs
 * ═══════════════════════════════════════════════════════════════ */

export async function getKpis(
  businessIds: string[],
  range: DateRange
): Promise<AnalyticsKpis> {
  if (businessIds.length === 0) {
    return { salesTotal: 0, salesCount: 0, expensesTotal: 0, withdrawalsTotal: 0, netTotal: 0, avgTicket: 0 };
  }

  const [salesAgg, expensesAgg, withdrawalsAgg] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
      _sum: { amountCents: true },
    }),
    prisma.withdrawal.aggregate({
      where: {
        businessId: { in: businessIds }, status: "APPROVED",
        createdAt: { gte: range.from, lt: range.to },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const salesTotal = salesAgg._sum.amountCents ?? 0;
  const salesCount = salesAgg._count ?? 0;
  const expensesTotal = expensesAgg._sum.amountCents ?? 0;
  const withdrawalsTotal = withdrawalsAgg._sum.amountCents ?? 0;
  const netTotal = salesTotal - expensesTotal;
  const avgTicket = salesCount > 0 ? Math.round(salesTotal / salesCount) : 0;

  return { salesTotal, salesCount, expensesTotal, withdrawalsTotal, netTotal, avgTicket };
}

export async function getKpisWithDelta(
  businessIds: string[],
  range: DateRange,
  comparison: DateRange | null
): Promise<AnalyticsKpisWithDelta> {
  const current = await getKpis(businessIds, range);
  if (!comparison) {
    return { ...current, salesDelta: null, expensesDelta: null, netDelta: null, avgTicketDelta: null };
  }
  const previous = await getKpis(businessIds, comparison);

  const calcDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr === 0 ? 0 : null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  return {
    ...current,
    salesDelta: calcDelta(current.salesTotal, previous.salesTotal),
    expensesDelta: calcDelta(current.expensesTotal, previous.expensesTotal),
    netDelta: calcDelta(current.netTotal, previous.netTotal),
    avgTicketDelta: calcDelta(current.avgTicket, previous.avgTicket),
  };
}

/* ═══════════════════════════════════════════════════════════════
 * SERIES TEMPORALES (TZ MX vía DATE_TRUNC con AT TIME ZONE)
 * ═══════════════════════════════════════════════════════════════ */

export async function getSalesTimeSeries(
  businessIds: string[],
  range: DateRange,
  granularity: "day" | "week" | "month"
): Promise<TimeSeriesPoint[]> {
  if (businessIds.length === 0) return [];

  const truncFn = granularity === "month" ? "month" : granularity === "week" ? "week" : "day";
  const bizPlaceholders = Prisma.join(businessIds.map((id) => Prisma.sql`${id}`));

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; total: bigint; count: bigint }>
  >(Prisma.sql`
    SELECT
      DATE_TRUNC(${truncFn}, "createdAt" AT TIME ZONE 'America/Mexico_City') AS bucket,
      SUM("amountCents")::bigint AS total,
      COUNT(*)::bigint AS count
    FROM "Sale"
    WHERE "businessId" IN (${bizPlaceholders})
      AND "createdAt" >= ${range.from}
      AND "createdAt" < ${range.to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  return rows.map((r) => ({
    date: r.bucket.toISOString().slice(0, 10),
    label: formatDateForChart(r.bucket, granularity),
    value: Number(r.total),
    count: Number(r.count),
  }));
}

export async function getExpensesTimeSeries(
  businessIds: string[],
  range: DateRange,
  granularity: "day" | "week" | "month"
): Promise<TimeSeriesPoint[]> {
  if (businessIds.length === 0) return [];

  const truncFn = granularity === "month" ? "month" : granularity === "week" ? "week" : "day";
  const bizPlaceholders = Prisma.join(businessIds.map((id) => Prisma.sql`${id}`));

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; total: bigint; count: bigint }>
  >(Prisma.sql`
    SELECT
      DATE_TRUNC(${truncFn}, "createdAt" AT TIME ZONE 'America/Mexico_City') AS bucket,
      SUM("amountCents")::bigint AS total,
      COUNT(*)::bigint AS count
    FROM "Expense"
    WHERE "businessId" IN (${bizPlaceholders})
      AND "createdAt" >= ${range.from}
      AND "createdAt" < ${range.to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  return rows.map((r) => ({
    date: r.bucket.toISOString().slice(0, 10),
    label: formatDateForChart(r.bucket, granularity),
    value: Number(r.total),
    count: Number(r.count),
  }));
}

/* ═══════════════════════════════════════════════════════════════
 * DISTRIBUCIONES
 * ═══════════════════════════════════════════════════════════════ */

export async function getSalesByMethod(
  businessIds: string[],
  range: DateRange
): Promise<DistributionItem[]> {
  if (businessIds.length === 0) return [];

  const groups = await prisma.sale.groupBy({
    by: ["method"],
    where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
    _sum: { amountCents: true },
    _count: true,
  });

  const total = groups.reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);
  const methodLabels: Record<string, string> = {
    CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia",
  };

  return groups
    .map((g) => {
      const value = g._sum.amountCents ?? 0;
      return {
        key: g.method,
        label: methodLabels[g.method] ?? g.method,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        count: g._count,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export async function getExpensesByCategory(
  businessIds: string[],
  range: DateRange
): Promise<DistributionItem[]> {
  if (businessIds.length === 0) return [];

  const groups = await prisma.expense.groupBy({
    by: ["category"],
    where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
    _sum: { amountCents: true },
    _count: true,
  });

  const total = groups.reduce((s, g) => s + (g._sum.amountCents ?? 0), 0);

  return groups
    .map((g) => {
      const value = g._sum.amountCents ?? 0;
      return {
        key: g.category,
        label: g.category,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        count: g._count,
      };
    })
    .sort((a, b) => b.value - a.value);
}

/* ═══════════════════════════════════════════════════════════════
 * POR NEGOCIO
 * ═══════════════════════════════════════════════════════════════ */

export async function getAnalyticsByBusiness(
  businessIds: string[],
  businessesMap: Map<string, string>,
  range: DateRange
): Promise<BusinessAnalyticsRow[]> {
  if (businessIds.length === 0) return [];

  const [salesGroups, expensesGroups] = await Promise.all([
    prisma.sale.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds }, createdAt: { gte: range.from, lt: range.to } },
      _sum: { amountCents: true },
    }),
  ]);

  return businessIds
    .map((id) => {
      const sales = salesGroups.find((s) => s.businessId === id);
      const expenses = expensesGroups.find((e) => e.businessId === id);
      const salesTotal = sales?._sum.amountCents ?? 0;
      const expensesTotal = expenses?._sum.amountCents ?? 0;
      return {
        businessId: id,
        businessName: businessesMap.get(id) ?? "Negocio",
        salesTotal,
        salesCount: sales?._count ?? 0,
        expensesTotal,
        netTotal: salesTotal - expensesTotal,
      };
    })
    .sort((a, b) => b.salesTotal - a.salesTotal);
}

/* ═══════════════════════════════════════════════════════════════
 * DRILL DOWN
 * ═══════════════════════════════════════════════════════════════ */

export async function getSalesDrillDown(
  businessIds: string[],
  range: DateRange,
  filters: { method?: "CASH" | "CARD" | "TRANSFER" } = {},
  limit = 100
) {
  if (businessIds.length === 0) return [];

  const sales = await prisma.sale.findMany({
    where: {
      businessId: { in: businessIds },
      createdAt: { gte: range.from, lt: range.to },
      ...(filters.method ? { method: filters.method } : {}),
    },
    include: {
      business: { select: { name: true } },
      user: { select: { fullName: true } },
      cashpoint: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return sales.map((s) => ({
    id: s.id,
    amountCents: s.amountCents,
    method: s.method,
    concept: s.concept,
    createdAt: s.createdAt,
    businessName: s.business.name,
    userName: s.user.fullName,
    cashpointName: s.cashpoint.name,
  }));
}

export async function getExpensesDrillDown(
  businessIds: string[],
  range: DateRange,
  filters: { category?: string } = {},
  limit = 100
) {
  if (businessIds.length === 0) return [];

  const expenses = await prisma.expense.findMany({
    where: {
      businessId: { in: businessIds },
      createdAt: { gte: range.from, lt: range.to },
      ...(filters.category ? { category: filters.category } : {}),
    },
    include: {
      business: { select: { name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return expenses.map((e) => ({
    id: e.id,
    amountCents: e.amountCents,
    category: e.category,
    note: e.note,
    createdAt: e.createdAt,
    businessName: e.business.name,
    userName: e.user.fullName,
  }));
}

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { DateRange } from "@/lib/date-presets";

export type WeekdayPoint = {
  weekday: number;     // 0=Dom, 1=Lun, ... 6=Sáb (Postgres convention)
  label: string;       // "Lun", "Mar", etc.
  value: number;       // cents
  count: number;
};

export type HourPoint = {
  hour: number;        // 0-23
  label: string;       // "00h", "01h", etc.
  value: number;       // cents
  count: number;
};

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Ventas agrupadas por día de la semana en TZ México.
 * Útil para detectar patrones (¿qué días vendes más?).
 */
export async function getSalesByWeekday(
  businessIds: string[],
  range: DateRange
): Promise<WeekdayPoint[]> {
  if (businessIds.length === 0) return [];

  const bizPlaceholders = Prisma.join(businessIds.map((id) => Prisma.sql`${id}`));

  const rows = await prisma.$queryRaw<
    Array<{ weekday: number; total: bigint; count: bigint }>
  >(Prisma.sql`
    SELECT
      EXTRACT(DOW FROM ("createdAt" AT TIME ZONE 'America/Mexico_City'))::int AS weekday,
      SUM("amountCents")::bigint AS total,
      COUNT(*)::bigint AS count
    FROM "Sale"
    WHERE "businessId" IN (${bizPlaceholders})
      AND "createdAt" >= ${range.from}
      AND "createdAt" < ${range.to}
    GROUP BY weekday
    ORDER BY weekday ASC
  `);

  // Asegurar que todos los días aparecen (rellenar con 0)
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const row = byWeekday.get(dow);
    return {
      weekday: dow,
      label: WEEKDAY_LABELS[dow],
      value: row ? Number(row.total) : 0,
      count: row ? Number(row.count) : 0,
    };
  });
}

/**
 * Ventas agrupadas por hora del día (0-23) en TZ México.
 * Útil para ver horas pico.
 */
export async function getSalesByHour(
  businessIds: string[],
  range: DateRange
): Promise<HourPoint[]> {
  if (businessIds.length === 0) return [];

  const bizPlaceholders = Prisma.join(businessIds.map((id) => Prisma.sql`${id}`));

  const rows = await prisma.$queryRaw<
    Array<{ hour: number; total: bigint; count: bigint }>
  >(Prisma.sql`
    SELECT
      EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'America/Mexico_City'))::int AS hour,
      SUM("amountCents")::bigint AS total,
      COUNT(*)::bigint AS count
    FROM "Sale"
    WHERE "businessId" IN (${bizPlaceholders})
      AND "createdAt" >= ${range.from}
      AND "createdAt" < ${range.to}
    GROUP BY hour
    ORDER BY hour ASC
  `);

  const byHour = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, h) => {
    const row = byHour.get(h);
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}h`,
      value: row ? Number(row.total) : 0,
      count: row ? Number(row.count) : 0,
    };
  });
}

/**
 * Comparativo lado a lado de negocios.
 * Para cada negocio: ventas, gastos, neto, ticket promedio del período.
 */
export type BusinessComparisonRow = {
  businessId: string;
  businessName: string;
  salesTotal: number;
  salesCount: number;
  expensesTotal: number;
  netTotal: number;
  avgTicket: number;
  // Si hay comparación
  salesDelta: number | null;
  netDelta: number | null;
};

export async function getBusinessComparison(
  businessIds: string[],
  businessesMap: Map<string, string>,
  range: DateRange,
  comparison: DateRange | null
): Promise<BusinessComparisonRow[]> {
  if (businessIds.length === 0) return [];

  const [salesGroups, expensesGroups, salesCompGroups, expensesCompGroups] = await Promise.all([
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
    comparison ? prisma.sale.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds }, createdAt: { gte: comparison.from, lt: comparison.to } },
      _sum: { amountCents: true },
    }) : Promise.resolve([]),
    comparison ? prisma.expense.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds }, createdAt: { gte: comparison.from, lt: comparison.to } },
      _sum: { amountCents: true },
    }) : Promise.resolve([]),
  ]);

  const calcDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr === 0 ? 0 : null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  return businessIds
    .map((id) => {
      const sales = salesGroups.find((s) => s.businessId === id);
      const expenses = expensesGroups.find((e) => e.businessId === id);
      const salesComp = salesCompGroups.find((s) => s.businessId === id);
      const expensesComp = expensesCompGroups.find((e) => e.businessId === id);

      const salesTotal = sales?._sum.amountCents ?? 0;
      const salesCount = sales?._count ?? 0;
      const expensesTotal = expenses?._sum.amountCents ?? 0;
      const netTotal = salesTotal - expensesTotal;

      const salesCompTotal = salesComp?._sum.amountCents ?? 0;
      const expensesCompTotal = expensesComp?._sum.amountCents ?? 0;
      const netCompTotal = salesCompTotal - expensesCompTotal;

      return {
        businessId: id,
        businessName: businessesMap.get(id) ?? "Negocio",
        salesTotal,
        salesCount,
        expensesTotal,
        netTotal,
        avgTicket: salesCount > 0 ? Math.round(salesTotal / salesCount) : 0,
        salesDelta: comparison ? calcDelta(salesTotal, salesCompTotal) : null,
        netDelta: comparison ? calcDelta(netTotal, netCompTotal) : null,
      };
    })
    .sort((a, b) => b.salesTotal - a.salesTotal);
}

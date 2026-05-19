"use server";

import { prisma } from "@/lib/prisma";
import { resolveManagerScope } from "@/lib/manager-scope";

// ──────────────────────────────────────────────────────────
// TIPOS comunes
// ──────────────────────────────────────────────────────────
export type ReportFilters = {
  businessId?: string;
  fromDate?: string;
  toDate?: string;
  groupCode?: string;
  includeCanceled?: boolean;
};

async function getScopedWhere(filters: ReportFilters) {
  const scope = await resolveManagerScope();
  const businessIds = filters.businessId ? [filters.businessId] : scope.businessIds;
  if (businessIds.length === 0) throw new Error("Sin negocios accesibles");

  const where: any = {
    businessId: { in: businessIds },
    isCanceled: filters.includeCanceled ? undefined : false,
  };
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      to.setDate(to.getDate() + 1);
      where.createdAt.lt = to;
    }
  }
  return { where, businessIds, scope };
}

// ============================================================
// 1. TOP PRODUCTOS
// ============================================================
export async function getTopProducts(
  filters: ReportFilters,
  options: { limit?: number; sortBy?: "revenue" | "qty" } = {}
) {
  const { where, businessIds } = await getScopedWhere(filters);
  const limit = options.limit || 20;
  const sortBy = options.sortBy || "revenue";

  const saleIdsResult = await prisma.sale.findMany({ where, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);
  if (saleIds.length === 0) return [];

  const lineWhere: any = { saleId: { in: saleIds }, businessId: { in: businessIds } };
  if (filters.groupCode) lineWhere.groupCode = filters.groupCode;

  const grouped = await prisma.saleLine.groupBy({
    by: ["productCode", "productName", "groupCode", "groupName"],
    where: lineWhere,
    _sum: { amountCents: true, qty: true, discountCents: true },
    _count: { id: true },
    orderBy: sortBy === "revenue"
      ? { _sum: { amountCents: "desc" } }
      : { _sum: { qty: "desc" } },
    take: limit,
  });

  return grouped.map((g: any) => ({
    productCode: g.productCode || "?",
    productName: g.productName,
    groupCode: g.groupCode,
    groupName: g.groupName,
    revenue: (g._sum.amountCents || 0) / 100,
    qty: g._sum.qty || 0,
    discount: (g._sum.discountCents || 0) / 100,
    timesSold: g._count.id,
  }));
}

// ============================================================
// 2. PRODUCTOS LENTOS
// ============================================================
export async function getSlowProducts(
  filters: ReportFilters,
  options: { limit?: number } = {}
) {
  const { where, businessIds } = await getScopedWhere(filters);
  const limit = options.limit || 30;

  const saleIdsResult = await prisma.sale.findMany({ where, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);
  if (saleIds.length === 0) return [];

  const grouped = await prisma.saleLine.groupBy({
    by: ["productCode", "productName", "groupName"],
    where: { saleId: { in: saleIds }, businessId: { in: businessIds } },
    _sum: { amountCents: true, qty: true },
    _count: { id: true },
    orderBy: { _sum: { qty: "asc" } },
    take: limit,
  });

  return grouped.map((g: any) => ({
    productCode: g.productCode || "?",
    productName: g.productName,
    groupName: g.groupName,
    revenue: (g._sum.amountCents || 0) / 100,
    qty: g._sum.qty || 0,
    timesSold: g._count.id,
  }));
}

// ============================================================
// 3. PRODUCTOS SIN MOVIMIENTO
// ============================================================
export async function getNoMovementProducts(filters: ReportFilters) {
  const { businessIds } = await getScopedWhere(filters);

  const allCatalog = await prisma.menuItem.findMany({
    where: {
      businessId: { in: businessIds },
      isActive: true,
      isPhantom: false,
    },
    select: { id: true, externalCode: true, name: true, groupName: true, priceCents: true },
  });

  const { where: saleWhere } = await getScopedWhere(filters);
  const saleIdsResult = await prisma.sale.findMany({ where: saleWhere, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);

  const soldCodesResult = saleIds.length === 0 ? [] : await prisma.saleLine.findMany({
    where: { saleId: { in: saleIds }, businessId: { in: businessIds } },
    distinct: ["productCode"],
    select: { productCode: true },
  });
  const soldCodes = new Set(soldCodesResult.map((s: any) => s.productCode).filter(Boolean));

  return allCatalog
    .filter((p: any) => !soldCodes.has(p.externalCode || ""))
    .map((p: any) => ({
      productCode: p.externalCode || "?",
      productName: p.name,
      groupName: p.groupName,
      priceCents: p.priceCents,
    }))
    .sort((a: any, b: any) => a.productName.localeCompare(b.productName));
}

// ============================================================
// 4. MIX POR GRUPO
// ============================================================
export async function getGroupMix(filters: ReportFilters) {
  const { where, businessIds } = await getScopedWhere(filters);

  const saleIdsResult = await prisma.sale.findMany({ where, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);
  if (saleIds.length === 0) return [];

  const grouped = await prisma.saleLine.groupBy({
    by: ["groupCode", "groupName"],
    where: { saleId: { in: saleIds }, businessId: { in: businessIds } },
    _sum: { amountCents: true, qty: true },
    _count: { id: true },
  });

  const totalRevenue = grouped.reduce((sum: number, g: any) => sum + (g._sum.amountCents || 0), 0);

  return grouped
    .map((g: any) => ({
      groupCode: g.groupCode || "?",
      groupName: g.groupName || "Sin categoría",
      revenue: (g._sum.amountCents || 0) / 100,
      qty: g._sum.qty || 0,
      times: g._count.id,
      pctOfTotal: totalRevenue ? ((g._sum.amountCents || 0) / totalRevenue) * 100 : 0,
    }))
    .sort((a: any, b: any) => b.revenue - a.revenue);
}

// ============================================================
// 5. HEAT MAP
// ============================================================
export async function getHourlyHeatmap(filters: ReportFilters) {
  const { businessIds } = await getScopedWhere(filters);
  const fromDate = filters.fromDate ? `'${filters.fromDate}'::date` : "'2020-01-01'::date";
  const toDate = filters.toDate ? `'${filters.toDate}'::date + 1` : "now() + interval '1 day'";
  const bidList = businessIds.map(b => `'${b.replace(/'/g, "''")}'`).join(",");

  const rawQuery = `
    SELECT 
      EXTRACT(DOW FROM "createdAt" AT TIME ZONE 'America/Mexico_City')::int as dow,
      EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Mexico_City')::int as hour,
      COUNT(*)::int as tickets,
      SUM("amountCents")::bigint as total_cents,
      AVG("amountCents")::int as avg_cents
    FROM "Sale"
    WHERE "businessId" IN (${bidList})
      AND "isCanceled" = false
      AND "createdAt" >= ${fromDate}
      AND "createdAt" < ${toDate}
    GROUP BY dow, hour
    ORDER BY dow, hour
  `;

  const rows: any[] = await prisma.$queryRawUnsafe(rawQuery);
  return rows.map(r => ({
    dow: Number(r.dow),
    hour: Number(r.hour),
    tickets: Number(r.tickets),
    revenue: Number(r.total_cents) / 100,
    avgTicket: Number(r.avg_cents) / 100,
  }));
}

// ============================================================
// 6. TICKET STATS
// ============================================================
export async function getTicketStats(filters: ReportFilters) {
  const { where } = await getScopedWhere(filters);

  const sales = await prisma.sale.findMany({
    where,
    select: { id: true, amountCents: true, totalItems: true, createdAt: true },
  });

  if (sales.length === 0) {
    return {
      count: 0, totalRevenue: 0, avgTicket: 0,
      medianTicket: 0, p25: 0, p75: 0,
      maxTicket: 0, minTicket: 0,
      avgItemsPerTicket: 0, totalItems: 0,
    };
  }

  const amounts = sales.map((s: any) => s.amountCents).sort((a: number, b: number) => a - b);
  const total = amounts.reduce((s: number, a: number) => s + a, 0);
  const items = sales.reduce((s: number, x: any) => s + (x.totalItems || 0), 0);

  return {
    count: sales.length,
    totalRevenue: total / 100,
    avgTicket: (total / sales.length) / 100,
    medianTicket: amounts[Math.floor(amounts.length / 2)] / 100,
    p25: amounts[Math.floor(amounts.length * 0.25)] / 100,
    p75: amounts[Math.floor(amounts.length * 0.75)] / 100,
    maxTicket: amounts[amounts.length - 1] / 100,
    minTicket: amounts[0] / 100,
    avgItemsPerTicket: items / sales.length,
    totalItems: items,
  };
}

export async function getTicketDistribution(filters: ReportFilters) {
  const { where } = await getScopedWhere(filters);
  const sales = await prisma.sale.findMany({ where, select: { amountCents: true } });

  const buckets = [
    { label: "$0-100", min: 0, max: 100, count: 0, revenue: 0 },
    { label: "$100-300", min: 100, max: 300, count: 0, revenue: 0 },
    { label: "$300-500", min: 300, max: 500, count: 0, revenue: 0 },
    { label: "$500-1k", min: 500, max: 1000, count: 0, revenue: 0 },
    { label: "$1k-2k", min: 1000, max: 2000, count: 0, revenue: 0 },
    { label: "$2k-5k", min: 2000, max: 5000, count: 0, revenue: 0 },
    { label: "$5k+", min: 5000, max: Infinity, count: 0, revenue: 0 },
  ];

  for (const s of sales) {
    const amount = (s as any).amountCents / 100;
    const bucket = buckets.find(b => amount >= b.min && amount < b.max);
    if (bucket) {
      bucket.count++;
      bucket.revenue += amount;
    }
  }
  return buckets;
}

// ============================================================
// 7. DESCUENTOS
// ============================================================
export async function getDiscountAnalysis(filters: ReportFilters) {
  const { where, businessIds } = await getScopedWhere(filters);

  const salesWithDiscount = await prisma.sale.findMany({
    where: { ...where, discountCents: { gt: 0 } },
    select: { discountCents: true, amountCents: true, subtotalCents: true },
  });
  const allSales = await prisma.sale.aggregate({
    where,
    _count: true,
    _sum: { amountCents: true, discountCents: true },
  });

  const totalSales = allSales._count;
  const salesWithDisc = salesWithDiscount.length;
  const totalDiscountChq = (allSales._sum.discountCents || 0) / 100;

  const saleIdsResult = await prisma.sale.findMany({ where, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);

  const lineDiscounts = saleIds.length === 0 ? null : await prisma.saleLine.aggregate({
    where: {
      saleId: { in: saleIds },
      businessId: { in: businessIds },
      discountCents: { gt: 0 },
    },
    _sum: { discountCents: true },
    _count: true,
  });

  const topDiscounted = saleIds.length === 0 ? [] : await prisma.saleLine.groupBy({
    by: ["productCode", "productName"],
    where: {
      saleId: { in: saleIds },
      businessId: { in: businessIds },
      discountCents: { gt: 0 },
    },
    _sum: { discountCents: true, qty: true },
    _count: true,
    orderBy: { _sum: { discountCents: "desc" } },
    take: 15,
  });

  return {
    totalSales,
    salesWithDiscount: salesWithDisc,
    pctSalesWithDiscount: totalSales ? (salesWithDisc / totalSales) * 100 : 0,
    totalDiscountAmount: totalDiscountChq,
    avgDiscountPerTicket: salesWithDisc ? totalDiscountChq / salesWithDisc : 0,
    lineDiscountCount: lineDiscounts?._count || 0,
    lineDiscountAmount: (lineDiscounts?._sum.discountCents || 0) / 100,
    topDiscountedProducts: topDiscounted.map((t: any) => ({
      productCode: t.productCode || "?",
      productName: t.productName,
      timesDiscounted: t._count,
      qtyDiscounted: t._sum.qty || 0,
      totalDiscount: (t._sum.discountCents || 0) / 100,
    })),
  };
}

// ============================================================
// 8. COMPARAR PRODUCTOS
// ============================================================
export async function compareProducts(filters: ReportFilters, productCodes: string[]) {
  const { where, businessIds } = await getScopedWhere(filters);
  if (productCodes.length === 0) return [];

  const saleIdsResult = await prisma.sale.findMany({ where, select: { id: true } });
  const saleIds = saleIdsResult.map((s: any) => s.id);
  if (saleIds.length === 0) return [];

  const results = await prisma.saleLine.groupBy({
    by: ["productCode", "productName", "groupName"],
    where: {
      saleId: { in: saleIds },
      businessId: { in: businessIds },
      productCode: { in: productCodes },
    },
    _sum: { amountCents: true, qty: true, discountCents: true },
    _count: { id: true },
  });

  const trends: Record<string, { week: string; revenue: number; qty: number }[]> = {};

  const fromDate = filters.fromDate ? `'${filters.fromDate}'::date` : "'2020-01-01'::date";
  const toDate = filters.toDate ? `'${filters.toDate}'::date + 1` : "now() + interval '1 day'";
  const bidList = businessIds.map(b => `'${b.replace(/'/g, "''")}'`).join(",");
  const codeList = productCodes.map(c => `'${c.replace(/'/g, "''")}'`).join(",");

  const trendQuery = `
    SELECT 
      sl."productCode" as code,
      DATE_TRUNC('week', s."createdAt" AT TIME ZONE 'America/Mexico_City') as week,
      SUM(sl."amountCents")::bigint as total_cents,
      SUM(sl.qty)::float as total_qty
    FROM "SaleLine" sl
    JOIN "Sale" s ON s.id = sl."saleId"
    WHERE s."businessId" IN (${bidList})
      AND s."isCanceled" = false
      AND s."createdAt" >= ${fromDate}
      AND s."createdAt" < ${toDate}
      AND sl."productCode" IN (${codeList})
    GROUP BY sl."productCode", week
    ORDER BY sl."productCode", week
  `;

  const trendRows: any[] = await prisma.$queryRawUnsafe(trendQuery);
  for (const row of trendRows) {
    if (!trends[row.code]) trends[row.code] = [];
    trends[row.code].push({
      week: new Date(row.week).toISOString().slice(0, 10),
      revenue: Number(row.total_cents) / 100,
      qty: Number(row.total_qty),
    });
  }

  return results.map((r: any) => ({
    productCode: r.productCode || "?",
    productName: r.productName,
    groupName: r.groupName,
    revenue: (r._sum.amountCents || 0) / 100,
    qty: r._sum.qty || 0,
    discount: (r._sum.discountCents || 0) / 100,
    timesSold: r._count.id,
    trend: trends[r.productCode || ""] || [],
  }));
}

// ============================================================
// 9. EVENTOS vs REGULAR
// ============================================================
export async function getEventsVsRegular(filters: ReportFilters) {
  const { where } = await getScopedWhere(filters);
  const sales = await prisma.sale.findMany({
    where,
    select: { id: true, amountCents: true, totalItems: true },
  });

  let regular = { count: 0, revenue: 0 };
  let events = { count: 0, revenue: 0 };

  for (const s of sales) {
    const sale: any = s;
    const isEvent = (sale.totalItems && sale.totalItems >= 8) || sale.amountCents >= 200000;
    if (isEvent) {
      events.count++;
      events.revenue += sale.amountCents / 100;
    } else {
      regular.count++;
      regular.revenue += sale.amountCents / 100;
    }
  }

  return {
    regular,
    events,
    avgEvent: events.count ? events.revenue / events.count : 0,
    avgRegular: regular.count ? regular.revenue / regular.count : 0,
  };
}

// ============================================================
// 10. CATÁLOGO HEALTH
// ============================================================
export async function getCatalogHealth(filters: ReportFilters) {
  const { businessIds } = await getScopedWhere(filters);

  const phantoms = await prisma.menuItem.findMany({
    where: { businessId: { in: businessIds }, isPhantom: true },
    select: { id: true, externalCode: true, name: true, priceCents: true },
  });

  const noPriced = await prisma.menuItem.findMany({
    where: {
      businessId: { in: businessIds },
      priceCents: 0,
      isPhantom: false,
    },
    select: { id: true, externalCode: true, name: true, groupName: true },
  });

  const byName = await prisma.menuItem.groupBy({
    by: ["name"],
    where: { businessId: { in: businessIds }, isPhantom: false },
    _count: true,
    having: { name: { _count: { gt: 1 } } },
  });

  return {
    phantomsCount: phantoms.length,
    phantoms,
    noPriceCount: noPriced.length,
    noPriced,
    duplicateNames: byName.map((d: any) => ({ name: d.name, count: d._count })),
  };
}

// ============================================================
// HELPERS UI
// ============================================================
export async function getAvailableGroups(businessId?: string) {
  const scope = await resolveManagerScope();
  const businessIds = businessId ? [businessId] : scope.businessIds;

  const groups = await prisma.menuItem.findMany({
    where: { businessId: { in: businessIds }, groupCode: { not: null } },
    distinct: ["groupCode", "groupName"],
    select: { groupCode: true, groupName: true },
  });
  return groups
    .filter((g: any) => g.groupCode)
    .map((g: any) => ({ code: g.groupCode!, name: g.groupName || g.groupCode! }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function getProductsList(businessId?: string, search?: string) {
  const scope = await resolveManagerScope();
  const businessIds = businessId ? [businessId] : scope.businessIds;

  const where: any = { businessId: { in: businessIds }, isActive: true };
  if (search && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { externalCode: { contains: search } },
    ];
  }

  const items = await prisma.menuItem.findMany({
    where,
    select: { externalCode: true, name: true, groupName: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  return items
    .filter((i: any) => i.externalCode)
    .map((i: any) => ({ code: i.externalCode!, name: i.name, groupName: i.groupName }));
}

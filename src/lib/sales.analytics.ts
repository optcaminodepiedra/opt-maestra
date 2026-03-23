import { prisma } from "@/lib/prisma";

export type RangeKey = "today" | "yesterday" | "7d" | "month";

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

export async function getSalesAnalytics(input: {
  range?: RangeKey;
  from?: string;
  to?: string;
}) {
  let start: Date;
  let end: Date;

  if (input.from && input.to) {
    start = startOfDayLocal(new Date(`${input.from}T00:00:00`));
    end = endOfDayLocal(new Date(`${input.to}T23:59:59`));
  } else {
    const now = new Date();
    if (input.range === "today") {
      start = startOfDayLocal(now); end = endOfDayLocal(now);
    } else if (input.range === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      start = startOfDayLocal(y); end = endOfDayLocal(y);
    } else if (input.range === "7d") {
      start = startOfDayLocal(now); start.setDate(start.getDate() - 6);
      end = endOfDayLocal(now);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0); end = endOfDayLocal(now);
    }
  }

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  const totalCents = sales.reduce((sum, s) => sum + s.amountCents, 0);
  const count = sales.length;
  const avgCents = count ? Math.round(totalCents / count) : 0;

  const byMethodMap = new Map<string, number>();
  for (const s of sales) {
    byMethodMap.set(s.method, (byMethodMap.get(s.method) ?? 0) + s.amountCents);
  }
  const byMethod = Array.from(byMethodMap.entries()).map(([method, cents]) => ({ method, total: cents / 100 }));

  const byBusinessMap = new Map<string, { id: string; name: string; cents: number }>();
  for (const s of sales) {
    const id = s.businessId;
    const name = s.business?.name ?? "—";
    const cur = byBusinessMap.get(id) ?? { id, name, cents: 0 };
    cur.cents += s.amountCents;
    byBusinessMap.set(id, cur);
  }
  const byBusiness = Array.from(byBusinessMap.values())
    .map((x) => ({ id: x.id, name: x.name, total: x.cents / 100 }))
    .sort((a, b) => b.total - a.total);

  const byDayMap = new Map<string, number>();
  for (const s of sales) {
    const k = s.createdAt.toISOString().split('T')[0];
    byDayMap.set(k, (byDayMap.get(k) ?? 0) + s.amountCents);
  }

  const days: string[] = [];
  const cursor = startOfDayLocal(start);
  const last = startOfDayLocal(end);
  while (cursor <= last) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const byDay = days.map((day) => ({
    day,
    total: (byDayMap.get(day) ?? 0) / 100,
  }));

  return {
    range: input.range || "custom",
    start: start.toISOString(),
    end: end.toISOString(),
    kpis: { total: totalCents / 100, count, avg: avgCents / 100 },
    byDay,
    byMethod,
    byBusiness,
  };
}
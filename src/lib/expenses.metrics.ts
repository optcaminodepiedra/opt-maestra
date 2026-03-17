"use server";

import { prisma } from "@/lib/prisma";

export type RangePreset = "today" | "7d" | "30d" | "ytd";

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

function rangeFromPresetLocal(preset: RangePreset) {
  const now = new Date();
  const end = endOfDayLocal(now);

  if (preset === "today") {
    return { start: startOfDayLocal(now), end, label: "Hoy" };
  }

  if (preset === "7d") {
    const start = startOfDayLocal(now);
    start.setDate(start.getDate() - 6);
    return { start, end, label: "Últimos 7 días" };
  }

  if (preset === "30d") {
    const start = startOfDayLocal(now);
    start.setDate(start.getDate() - 29);
    return { start, end, label: "Últimos 30 días" };
  }

  // ytd
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: "Año a la fecha (YTD)" };
}

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function moneyFromCents(cents: number) {
  return Math.round(cents) / 100;
}

function normalizePreset(p: any): RangePreset {
  const v = String(p || "").toLowerCase();
  if (v === "today" || v === "7d" || v === "30d" || v === "ytd") return v;
  return "30d";
}

export async function getOwnerExpensesDashboard(input: {
  businessId: string | null;
  preset: RangePreset;
}) {
  const preset = normalizePreset(input.preset);
  const { start, end, label } = rangeFromPresetLocal(preset);

  const expenses = await prisma.expense.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(input.businessId ? { businessId: input.businessId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      business: true,
      user: true,
    },
  });

  const totalCents = expenses.reduce((acc, e) => acc + e.amountCents, 0);

  // Por día
  const byDayMap = new Map<string, number>();
  for (const e of expenses) {
    const k = dayKeyLocal(e.createdAt);
    byDayMap.set(k, (byDayMap.get(k) || 0) + e.amountCents);
  }
  const byDay = Array.from(byDayMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, cents]) => ({ day, amount: moneyFromCents(cents) }));

  // Top categorías
  const categoryMap = new Map<string, number>();
  for (const e of expenses) {
    const key = (e.category || "Sin categoría").trim();
    categoryMap.set(key, (categoryMap.get(key) || 0) + e.amountCents);
  }
  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, cents]) => ({ category, amount: moneyFromCents(cents) }));

  // Top usuarios (quién registra / gasta más)
  const userMap = new Map<string, { name: string; cents: number }>();
  for (const e of expenses) {
    const id = e.userId;
    const name = e.user?.fullName ?? "—";
    const prev = userMap.get(id);
    if (!prev) userMap.set(id, { name, cents: e.amountCents });
    else prev.cents += e.amountCents;
  }
  const topUsers = Array.from(userMap.values())
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 10)
    .map((x) => ({ user: x.name, amount: moneyFromCents(x.cents) }));

  // Tabla detalle (últimos 80)
  const lastExpenses = expenses.slice(0, 80).map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    business: e.business?.name ?? "—",
    user: e.user?.fullName ?? "—",
    category: e.category,
    note: e.note ?? "",
    amount: moneyFromCents(e.amountCents),
  }));

  return {
    range: {
      preset,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    totals: {
      total: moneyFromCents(totalCents),
      count: expenses.length,
    },
    charts: {
      byDay,
      topCategories,
      topUsers,
    },
    table: {
      lastExpenses,
    },
  };
}

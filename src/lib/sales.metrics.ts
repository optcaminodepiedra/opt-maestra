"use server";

import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";

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

  if (preset === "today") return { start: startOfDayLocal(now), end, label: "Hoy" };
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

export async function getOwnerSalesDashboard(input: {
  businessId: string | null;
  preset?: RangePreset;
  from?: string;
  to?: string;
}) {
  let start: Date;
  let end: Date;
  let label: string;

  // Lógica del Calendario vs Botones
  if (input.from && input.to) {
    start = new Date(`${input.from}T00:00:00`);
    end = new Date(`${input.to}T23:59:59`);
    label = `Del ${input.from} al ${input.to}`;
  } else {
    const preset = normalizePreset(input.preset);
    const range = rangeFromPresetLocal(preset);
    start = range.start;
    end = range.end;
    label = range.label;
  }

  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(input.businessId ? { businessId: input.businessId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { business: true, cashpoint: true, user: true },
  });

  const totalCents = sales.reduce((acc, s) => acc + s.amountCents, 0);
  const byMethodCents: Record<PaymentMethod, number> = { CASH: 0, CARD: 0, TRANSFER: 0 };
  for (const s of sales) { byMethodCents[s.method] += s.amountCents; }

  const byDayMap = new Map<string, number>();
  for (const s of sales) {
    const k = dayKeyLocal(s.createdAt);
    byDayMap.set(k, (byDayMap.get(k) || 0) + s.amountCents);
  }

  const byDay = Array.from(byDayMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, cents]) => ({ day, amount: moneyFromCents(cents) }));

  const conceptMap = new Map<string, number>();
  for (const s of sales) {
    const key = (s.concept || "Sin concepto").trim();
    conceptMap.set(key, (conceptMap.get(key) || 0) + s.amountCents);
  }

  const topConcepts = Array.from(conceptMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([concept, cents]) => ({ concept, amount: moneyFromCents(cents) }));

  const cashpointMap = new Map<string, { name: string; business: string; cents: number }>();
  for (const s of sales) {
    const id = s.cashpointId;
    const prev = cashpointMap.get(id);
    const name = s.cashpoint?.name ?? "Caja";
    const business = s.business?.name ?? "Unidad";
    if (!prev) cashpointMap.set(id, { name, business, cents: s.amountCents });
    else prev.cents += s.amountCents;
  }

  const topCashpoints = Array.from(cashpointMap.values())
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 8)
    .map((x) => ({ name: x.name, business: x.business, amount: moneyFromCents(x.cents) }));

  return {
    range: { label, start: start.toISOString(), end: end.toISOString() },
    totals: {
      total: moneyFromCents(totalCents),
      cash: moneyFromCents(byMethodCents.CASH),
      card: moneyFromCents(byMethodCents.CARD),
      transfer: moneyFromCents(byMethodCents.TRANSFER),
    },
    charts: { byDay, topConcepts, topCashpoints },
    table: {
      lastSales: sales.slice(0, 60).map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        business: s.business?.name ?? "—",
        cashpoint: s.cashpoint?.name ?? "—",
        user: s.user?.fullName ?? "—",
        method: s.method,
        concept: s.concept,
        amount: moneyFromCents(s.amountCents),
      })),
    },
  };
}
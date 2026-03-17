"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportsRangeKey } from "@/lib/reports.actions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ReportsPayload = any;

function money(n: number) {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n ?? 0);
  } catch {
    return `$${Number(n ?? 0).toFixed(2)}`;
  }
}

function formatShortDate(isoYYYYMMDD: string) {
  // isoYYYYMMDD = "2026-02-05"
  const [y, m, d] = isoYYYYMMDD.split("-");
  return `${d}/${m}`;
}

export function ReportsClient({ initial }: { initial: ReportsPayload }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [range, setRange] = useState<ReportsRangeKey>(initial.range ?? "30d");
  const [businessId, setBusinessId] = useState<string>(initial.selectedBusiness?.id ?? "all");

  const businesses = initial.businesses ?? [];
  const totals = initial.totals ?? {};
  const daily = initial.dailySeries ?? [];
  const payment = initial.paymentBreakdown ?? [];
  const topBiz = initial.topBusinesses ?? [];
  const topCats = initial.topExpenseCategories ?? [];

  const palette = useMemo(
    () => ({
      wine: "#590F0F",
      olive: "#706513",
      amber: "#B57114",
      brick: "#962B09",
      sand: "#D9C7B8",
    }),
    []
  );

  function applyFilters(nextRange: ReportsRangeKey, nextBusinessId: string) {
    start(() => {
      const params = new URLSearchParams();
      params.set("range", nextRange);
      if (nextBusinessId && nextBusinessId !== "all") params.set("businessId", nextBusinessId);
      router.push(`/app/owner/reports?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="rounded-2xl border bg-card/80">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-xl">
                Rango
              </Badge>
              <Select
                value={range}
                onValueChange={(v) => {
                  const next = v as ReportsRangeKey;
                  setRange(next);
                  applyFilters(next, businessId);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecciona rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 días</SelectItem>
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="ytd">Año a la fecha</SelectItem>
                </SelectContent>
              </Select>

              <Badge variant="secondary" className="rounded-xl ml-2">
                Unidad
              </Badge>
              <Select
                value={businessId}
                onValueChange={(v) => {
                  setBusinessId(v);
                  applyFilters(range, v);
                }}
              >
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Todas las unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {businesses.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={pending} onClick={() => applyFilters(range, businessId)}>
                Refrescar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.wine}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold" style={{ color: palette.wine }}>
              {money(totals.sales)}
            </div>
            <div className="text-xs text-muted-foreground">{totals.salesCount ?? 0} movimientos</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.brick}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold" style={{ color: palette.brick }}>
              {money(totals.expenses)}
            </div>
            <div className="text-xs text-muted-foreground">{totals.expensesCount ?? 0} movimientos</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.amber}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Retiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold" style={{ color: palette.amber }}>
              {money(totals.withdrawals)}
            </div>
            <div className="text-xs text-muted-foreground">{totals.withdrawalsCount ?? 0} movimientos</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border" style={{ background: `linear-gradient(135deg, ${palette.olive}12, ${palette.sand}55)` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Neto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold" style={{ color: palette.olive }}>
              {money(totals.net)}
            </div>
            <div className="text-xs text-muted-foreground">Ventas - Gastos - Retiros</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Línea: Serie diaria */}
        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-base">Tendencia diaria</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} />
                <YAxis />
                <Tooltip formatter={(v: any) => money(Number(v))} labelFormatter={(l) => `Día ${l}`} />
                <Line type="monotone" dataKey="sales" stroke={palette.wine} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke={palette.brick} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withdrawals" stroke={palette.amber} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" stroke={palette.olive} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut: Métodos */}
        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-base">Métodos de pago</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Pie
                  data={payment}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={4}
                >
                  {payment.map((_: any, i: number) => (
                    <Cell
                      key={i}
                      fill={[palette.wine, palette.brick, palette.amber, palette.olive, palette.sand][i % 5]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Barras: Top unidades por ventas */}
        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-base">Top unidades por ventas</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBiz}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="sales" fill={palette.wine} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 text-xs text-muted-foreground">
              Tip: cambia la unidad arriba para ver su detalle aislado.
            </div>
          </CardContent>
        </Card>

        {/* Barras: Gastos por categoría */}
        <Card className="rounded-2xl border">
          <CardHeader>
            <CardTitle className="text-base">Gasto por categoría</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" hide />
                <YAxis />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="value" fill={palette.brick} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

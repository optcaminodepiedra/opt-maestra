"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Data = {
  range: { preset: string; label: string; start: string; end: string };
  totals: { total: number; cash: number; card: number; transfer: number };
  charts: {
    byDay: { day: string; amount: number }[];
    topConcepts: { concept: string; amount: number }[];
    topCashpoints: { name: string; business: string; amount: number }[];
  };
  table: {
    lastSales: {
      id: string;
      createdAt: string;
      business: string;
      cashpoint: string;
      user: string;
      method: "CASH" | "CARD" | "TRANSFER";
      concept: string;
      amount: number;
    }[];
  };
};

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function time(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodLabel(m: string) {
  if (m === "CASH") return "Efectivo";
  if (m === "CARD") return "Tarjeta";
  if (m === "TRANSFER") return "Transferencia";
  return m;
}

export function SalesDashboardClient({ data }: { data: Data }) {
  const byDay = data.charts.byDay;
  const topConcepts = data.charts.topConcepts;
  const topCashpoints = data.charts.topCashpoints;
  const lastSales = data.table.lastSales;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Ventas</div>
          <h1 className="text-2xl font-semibold">Panel de ventas</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {data.range.label}
          </div>
        </div>
        <Badge variant="secondary">{data.range.preset.toUpperCase()}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(data.totals.total)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Efectivo</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(data.totals.cash)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tarjeta</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(data.totals.card)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Transferencia</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(data.totals.transfer)}</CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ventas por día */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por día</CardTitle>
            <div className="text-xs text-muted-foreground">
              Tendencia del rango seleccionado
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickMargin={8} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={48} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.15)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top conceptos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top conceptos</CardTitle>
            <div className="text-xs text-muted-foreground">
              Lo que más está vendiendo (por concepto)
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topConcepts} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="concept" tick={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={48} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top cajas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top cajas</CardTitle>
          <div className="text-xs text-muted-foreground">
            Dónde se está cobrando más (caja / unidad)
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {topCashpoints.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin datos en el rango.</div>
          ) : (
            topCashpoints.map((c, idx) => (
              <div
                key={`${c.business}-${c.name}-${idx}`}
                className="rounded-xl border bg-card p-4"
              >
                <div className="text-xs text-muted-foreground">{c.business}</div>
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="mt-2 text-lg font-semibold">{money(c.amount)}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Tabla detalle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos movimientos</CardTitle>
          <div className="text-xs text-muted-foreground">
            Últimos 60 registros del rango
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Caja</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Sin ventas en el rango.
                  </TableCell>
                </TableRow>
              ) : (
                lastSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{time(s.createdAt)}</TableCell>
                    <TableCell>{s.business}</TableCell>
                    <TableCell>{s.cashpoint}</TableCell>
                    <TableCell>{s.user}</TableCell>
                    <TableCell>{methodLabel(s.method)}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{s.concept}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

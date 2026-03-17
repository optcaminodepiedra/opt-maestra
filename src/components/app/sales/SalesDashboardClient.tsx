"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function shortDay(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

type Props = {
  title?: string;
  rangeLabel: string;
  kpis: { total: number; count: number; avg: number };
  byDay: { day: string; total: number }[];
  byMethod: { method: string; total: number }[];
  byBusiness: { id: string; name: string; total: number }[];
};

export function SalesDashboardClient({
  title = "Ventas",
  rangeLabel,
  kpis,
  byDay,
  byMethod,
  byBusiness,
}: Props) {
  const pieData = useMemo(
    () =>
      byMethod
        .filter((x) => x.total > 0)
        .map((x) => ({ name: x.method, value: x.total })),
    [byMethod]
  );

  const hasData = kpis.count > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Análisis por rango · <span className="font-medium">{rangeLabel}</span>
          </p>
        </div>

        <Badge variant={hasData ? "secondary" : "destructive"}>
          {hasData ? "OK" : "Sin datos en el rango"}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total ventas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(kpis.total)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{kpis.count}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ticket promedio</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(kpis.avg)}</CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Line: ventas por día */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por día</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => shortDay(v)}
                  tickMargin={8}
                />
                <YAxis tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  formatter={(v: any) => money(Number(v))}
                  labelFormatter={(l: any) => `Día: ${l}`}
                />
                <Line type="monotone" dataKey="total" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie: métodos */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Métodos de pago</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                Sin datos
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {/* Recharts pide Cell; sin colores explícitos igual funciona,
                        pero algunos setups lo ven gris. Mantengo celdas sin fill. */}
                    {pieData.map((_, idx) => (
                      <Cell key={idx} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar: por unidad */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por unidad</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBusiness}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tickMargin={8} interval={0} height={70} angle={-18} textAnchor="end" />
                <YAxis tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byBusiness.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin datos</div>
            ) : (
              byBusiness.slice(0, 8).map((b, i) => (
                <div key={b.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {i + 1}. {b.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{b.id}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{money(b.total)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

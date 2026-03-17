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
  totals: { total: number; count: number };
  charts: {
    byDay: { day: string; amount: number }[];
    topCategories: { category: string; amount: number }[];
    topUsers: { user: string; amount: number }[];
  };
  table: {
    lastExpenses: {
      id: string;
      createdAt: string;
      business: string;
      user: string;
      category: string;
      note: string;
      amount: number;
    }[];
  };
};

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function dateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExpensesDashboardClient({ data }: { data: Data }) {
  const byDay = data.charts.byDay;
  const topCategories = data.charts.topCategories;
  const topUsers = data.charts.topUsers;
  const lastExpenses = data.table.lastExpenses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Gastos</div>
          <h1 className="text-2xl font-semibold">Panel de gastos</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {data.range.label}
          </div>
        </div>
        <Badge variant="secondary">{data.range.preset.toUpperCase()}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total de gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(data.totals.total)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {data.totals.count}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Promedio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(data.totals.count ? data.totals.total / data.totals.count : 0)}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gastos por día */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gastos por día</CardTitle>
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

        {/* Top categorías */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top categorías</CardTitle>
            <div className="text-xs text-muted-foreground">
              Dónde se está yendo el dinero
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={48} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top usuarios */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top usuarios</CardTitle>
          <div className="text-xs text-muted-foreground">
            Quién está registrando más gasto (en monto)
          </div>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topUsers} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="user" tick={false} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={48} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabla detalle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos gastos</CardTitle>
          <div className="text-xs text-muted-foreground">
            Últimos 80 registros del rango
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lastExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Sin gastos en el rango.
                  </TableCell>
                </TableRow>
              ) : (
                lastExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(e.createdAt)
}</TableCell>
                    <TableCell>{e.business}</TableCell>
                    <TableCell>{e.user}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{e.note}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(e.amount)}</TableCell>
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

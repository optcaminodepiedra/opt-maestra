"use client";

import * as React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function shortDay(day: string) {
  // day = YYYY-MM-DD
  const [y, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function OwnerExecutiveDashboard({ data }: { data: any }) {
  const totals = data.totals;

  const topBySales = [...data.byBusiness]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* HERO KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(totals.sales)}</CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(totals.expenses)}</CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Retiros</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(totals.withdrawals)}</CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Neto</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{money(totals.net)}</CardContent>
        </Card>
      </div>

      {/* GRÁFICAS */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle>Tendencia (día)</CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary">{data.range}</Badge>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/owner/reports">Ver reportes</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.seriesDaily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={shortDay} />
                <YAxis />
                <Tooltip formatter={(v: any) => money(Number(v))} labelFormatter={(l) => `Día: ${l}`} />
                <Line type="monotone" dataKey="sales" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top unidades (ventas)</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="sales" />
              </BarChart>
            </ResponsiveContainer>

            <Separator className="my-3" />

            <div className="space-y-2">
              {topBySales.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <Link className="hover:underline" href={`/app/owner/business/${b.id}`}>
                    {b.name}
                  </Link>
                  <span className="font-medium">{money(b.sales)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ALERTAS + KANBAN + APPS */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ALERTAS */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle>Alertas</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/inventory">Ir a almacén</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium">Stock bajo</div>
              <div className="text-xs text-muted-foreground">Items por debajo del mínimo</div>

              <div className="mt-2 space-y-2">
                {data.alerts.lowStock.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin alertas.</div>
                ) : (
                  data.alerts.lowStock.map((x: any) => (
                    <div key={x.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{x.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{x.business}</div>
                      </div>
                      <Badge variant="destructive">
                        {x.onHandQty}/{x.minQty}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-medium">Requisiciones</div>
              <div className="text-xs text-muted-foreground">Pendientes / en proceso</div>

              <div className="mt-2 space-y-2">
                {data.alerts.requisitions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin requisiciones activas.</div>
                ) : (
                  data.alerts.requisitions.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.business} · {r.createdBy} · {r.itemsCount} items
                        </div>
                      </div>
                      <Badge variant="secondary">{r.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KANBAN RESUMEN */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle>Operación</CardTitle>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/app/ops/kanban/activities">Actividades</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/ops/kanban/tickets">Tickets</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Actividades</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  TODO {data.kanban.activities.TODO} · DOING {data.kanban.activities.DOING} · BLOCKED {data.kanban.activities.BLOCKED} · DONE {data.kanban.activities.DONE}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">Tickets</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  TODO {data.kanban.tickets.TODO} · DOING {data.kanban.tickets.DOING} · BLOCKED {data.kanban.tickets.BLOCKED} · DONE {data.kanban.tickets.DONE}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-medium">Últimos cambios</div>
              <div className="mt-2 space-y-2">
                {data.kanban.latest.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.type} · {t.status} · {t.assigned?.fullName ?? "Sin asignar"} · {t.business?.name ?? "General"}
                      </div>
                    </div>
                    <Badge variant="secondary">{t.priority}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* APPS / SERVICIOS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Apps / Servicios</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Restaurante</div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/restaurant">Abrir</Link>
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Órdenes abiertas: <span className="font-medium">{data.apps.restaurant.openOrdersCount}</span> ·
                KDS pendiente: <span className="font-medium">{data.apps.restaurant.kdsPendingCount}</span>
              </div>
            </div>

            <div className="rounded-lg border p-3 opacity-70">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Hotel (PMS)</div>
                <Badge variant="secondary">Próx</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Ocupación, check-in/out, llaves NFC/RFID.</div>
            </div>

            <div className="rounded-lg border p-3 opacity-70">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Museos</div>
                <Badge variant="secondary">Próx</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Entradas en vivo, torniquetes, cortesías.</div>
            </div>

            <div className="rounded-lg border p-3 opacity-70">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Aventura / Rancho</div>
                <Badge variant="secondary">Próx</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Agenda caballos, flotilla RZR, GPS/geo-fence.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

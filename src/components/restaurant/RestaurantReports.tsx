"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function mxnFromCents(cents: number) {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

type Boot = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  cashpoints: { id: string; name: string }[];
  selectedCashpointId?: string | null;
};

type Report = {
  business: { id: string; name: string };
  cashpoints: { id: string; name: string }[];
  range: { from: string; to: string; cashpointId: string | null };

  kpis: {
    totalSalesCents: number;
    salesCount: number;
    ordersCount: number;
    avgTicketCents: number;
    itemsCount: number;
    itemsRevenueCents: number;
  };

  topProductsByQty: { id: string; name: string; category: string; qty: number; revenueCents: number }[];
  topProductsByRevenue: { id: string; name: string; category: string; qty: number; revenueCents: number }[];
  categories: { category: string; qty: number; revenueCents: number }[];
  days: { day: string; revenueCents: number; count: number }[];
  cashpointsBreakdown: { cashpointId: string | null; name: string; revenueCents: number; count: number }[];
};

export function RestaurantReports({
  boot,
  report,
  me,
}: {
  boot: Boot;
  report: Report;
  me: { role: string; allowedToSwitch: boolean };
}) {
  const router = useRouter();

  const businesses = boot?.businesses ?? [];
  const cashpoints = report?.cashpoints ?? boot?.cashpoints ?? [];

  const [businessId, setBusinessId] = React.useState<string>(boot?.businessId ?? report?.business?.id ?? "");
  const [from, setFrom] = React.useState<string>(report?.range?.from ?? "");
  const [to, setTo] = React.useState<string>(report?.range?.to ?? "");
  const [cashpointId, setCashpointId] = React.useState<string>(report?.range?.cashpointId ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (businessId) params.set("businessId", businessId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (cashpointId) params.set("cashpointId", cashpointId);

    router.push(`/app/restaurant/reports?${params.toString()}`);
    router.refresh();
  }

  const k = report.kpis;

  return (
    <div className="space-y-4">
      {/* Filtros PRO */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Filtros</CardTitle>
            <Badge variant="secondary">
              {report.business.name}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-4">
          {/* negocio */}
          <div className="space-y-2">
            <Label>Unidad</Label>
            {me.allowedToSwitch ? (
              <Select value={businessId} onValueChange={(v) => setBusinessId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-muted-foreground">
                Unidad fija por rol (staff).
              </div>
            )}
          </div>

          {/* cashpoint */}
          <div className="space-y-2">
            <Label>Caja/Local (opcional)</Label>
            <Select value={cashpointId} onValueChange={(v) => setCashpointId(v === "__ALL__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Todas</SelectItem>
                {cashpoints.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Útil si quieres ver Restaurante vs Barra vs Cantina, etc.
            </div>
          </div>

          {/* from */}
          <div className="space-y-2">
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          {/* to */}
          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setCashpointId(""); applyFilters(); }}>
              Quitar filtro caja/local
            </Button>
            <Button onClick={applyFilters}>
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{mxnFromCents(k.totalSalesCents)}</div>
            <div className="text-xs text-muted-foreground">{k.salesCount} tickets contables</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ticket promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{mxnFromCents(k.avgTicketCents)}</div>
            <div className="text-xs text-muted-foreground">promedio por ticket (Sale)</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Órdenes pagadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{k.ordersCount}</div>
            <div className="text-xs text-muted-foreground">cerradas como PAID</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Artículos vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{k.itemsCount}</div>
            <div className="text-xs text-muted-foreground">suma de qty en items</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="productos" className="space-y-3">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="dias">Días</TabsTrigger>
          <TabsTrigger value="cajas">Cajas/Locales</TabsTrigger>
        </TabsList>

        {/* Productos */}
        <TabsContent value="productos">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="font-medium">Por cantidad</div>
                  <div className="text-xs text-muted-foreground">Los más vendidos (unidades)</div>
                  <Separator className="my-2" />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topProductsByQty.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">{p.category}</TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <div className="font-medium">Por ingresos</div>
                  <div className="text-xs text-muted-foreground">Los que más dinero generan</div>
                  <Separator className="my-2" />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topProductsByRevenue.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">{p.category}</TableCell>
                          <TableCell className="text-right">{mxnFromCents(p.revenueCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorías */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Desglose por categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.categories.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">{c.category}</TableCell>
                      <TableCell className="text-right">{c.qty}</TableCell>
                      <TableCell className="text-right">{mxnFromCents(c.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Días */}
        <TabsContent value="dias">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ventas por día</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.days.map((d) => (
                    <TableRow key={d.day}>
                      <TableCell className="font-medium">{d.day}</TableCell>
                      <TableCell className="text-right">{d.count}</TableCell>
                      <TableCell className="text-right">{mxnFromCents(d.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="text-xs text-muted-foreground mt-2">
                *Tickets/ventas se calculan desde <b>Sale</b> (lo contable).
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cajas/Locales */}
        <TabsContent value="cajas">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ventas por caja/local</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caja/Local</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.cashpointsBreakdown.map((c) => (
                    <TableRow key={c.cashpointId || "GENERAL"}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right">{mxnFromCents(c.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="text-xs text-muted-foreground mt-2">
                Útil para detectar qué área está vendiendo más.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
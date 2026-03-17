"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addItemToOrder,
  closeOrderAsPaidAndCreateSale,
  getOpenOrderByTable,
  openOrder,
  sendOrderToKitchen,
  updateOrderItemQty,
} from "@/lib/restaurant.actions";
import { PaymentMethod } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function mxn(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function totalOrder(items: any[]) {
  return (items || []).reduce((sum, it) => sum + (it.priceCents * it.qty) / 100, 0);
}

type Boot = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  tables: any[];
  menu: any[];
  openOrders: any[];
  cashpoints: { id: string; name: string }[];
  selectedCashpointId?: string | null;
};

export function RestaurantPOS({
  boot,
  me,
}: {
  boot: Boot;
  me: { id: string; role: string; primaryBusinessId: string | null; allowedToSwitch: boolean };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const businesses = boot?.businesses ?? [];
  const tables = boot?.tables ?? [];
  const menu = boot?.menu ?? [];
  const cashpoints = boot?.cashpoints ?? [];

  // ✅ estados
  const [businessId, setBusinessId] = React.useState<string>(boot?.businessId ?? "");
  const [cashpointId, setCashpointId] = React.useState<string>(boot?.selectedCashpointId ?? "");
  const [concept, setConcept] = React.useState<string>("POS Restaurante");

  const [tableId, setTableId] = React.useState<string>("");
  const [order, setOrder] = React.useState<any | null>(null);

  // ✅ SINCRONIZA cuando cambia el boot (cuando cambias unidad/caja)
  React.useEffect(() => {
    const nextBusinessId = boot?.businessId ?? "";
    const nextCashpointId = boot?.selectedCashpointId ?? "";

    setBusinessId(nextBusinessId);
    setCashpointId(nextCashpointId);

    // reset selección de mesa/orden al cambiar contexto
    setTableId("");
    setOrder(null);
  }, [boot?.businessId, boot?.selectedCashpointId]);

  // ✅ helper para URL
  function pushPosUrl(next: { businessId?: string; cashpointId?: string }) {
    const qp = new URLSearchParams(sp?.toString() || "");

    const b = next.businessId ?? businessId;
    const c = next.cashpointId ?? cashpointId;

    if (b) qp.set("businessId", b);
    else qp.delete("businessId");

    if (c) qp.set("cashpointId", c);
    else qp.delete("cashpointId");

    router.push(`/app/restaurant/pos?${qp.toString()}`);
  }

  // Switch business
  function onBusinessChange(id: string) {
    // al cambiar unidad, dejamos que el server elija el primer cashpoint válido
    setBusinessId(id);
    setCashpointId("");
    setTableId("");
    setOrder(null);

    const qp = new URLSearchParams(sp?.toString() || "");
    qp.set("businessId", id);
    qp.delete("cashpointId"); // 🔥 clave
    router.push(`/app/restaurant/pos?${qp.toString()}`);
    router.refresh();
  }

  // Switch cashpoint
  function onCashpointChange(id: string) {
    setCashpointId(id);
    setTableId("");
    setOrder(null);
    pushPosUrl({ cashpointId: id });
    router.refresh();
  }

  // categorías
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of menu) set.add(m.category || "General");
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [menu]);

  const [category, setCategory] = React.useState<string>("");

  // ✅ sincroniza categoría cuando cambie el menú (por unidad/caja)
  React.useEffect(() => {
    if (!categories.length) {
      setCategory("");
      return;
    }
    // si la categoría actual no existe en el nuevo set, resetea a la primera
    if (!category || !categories.includes(category)) setCategory(categories[0]);
  }, [categories]); // intencional

  const menuByCategory = React.useMemo(() => {
    const cat = category || "General";
    return menu.filter((m: any) => (m.category || "General") === cat);
  }, [menu, category]);

  // Load/open order when selecting table
  async function selectTable(tid: string) {
    setTableId(tid);

    const existing = await getOpenOrderByTable({ tableId: tid });
    if (existing) {
      setOrder(existing);
      return;
    }

    const oid = await openOrder({
      businessId,
      tableId: tid,
      userId: me.id,
      note: null,
    });

    const fresh = await getOpenOrderByTable({ tableId: tid });
    setOrder(fresh || { id: oid, items: [] });
  }

  async function add(menuItemId: string) {
    if (!tableId || !order?.id) return;
    await addItemToOrder({ orderId: order.id, menuItemId, qty: 1 });
    const fresh = await getOpenOrderByTable({ tableId });
    setOrder(fresh);
  }

  async function inc(itemId: string, qty: number) {
    await updateOrderItemQty({ itemId, qty: qty + 1 });
    const fresh = await getOpenOrderByTable({ tableId });
    setOrder(fresh);
  }

  async function dec(itemId: string, qty: number) {
    await updateOrderItemQty({ itemId, qty: qty - 1 });
    const fresh = await getOpenOrderByTable({ tableId });
    setOrder(fresh);
  }

  async function sendKitchen() {
    if (!order?.id) return;
    await sendOrderToKitchen(order.id);
    const fresh = await getOpenOrderByTable({ tableId });
    setOrder(fresh);
  }

  // cobrar
  const [payOpen, setPayOpen] = React.useState(false);
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);

  async function pay() {
    if (!order?.id) return;
    if (!cashpointId) throw new Error("Selecciona una caja/punto");
    if (!businessId) throw new Error("Selecciona unidad");

    await closeOrderAsPaidAndCreateSale({
      orderId: order.id,
      businessId,
      userId: me.id,
      cashpointId,
      method,
      concept,
    });

    setPayOpen(false);
    setOrder(null);
    setTableId("");
    router.refresh();
  }

  // estados vacíos
  if (!businessId) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">POS Restaurante</h1>
        <p className="text-sm text-muted-foreground">No hay unidad seleccionada (o no hay unidades en BD).</p>
      </div>
    );
  }

  if (cashpoints.length === 0) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">POS Restaurante</h1>
        <p className="text-sm text-muted-foreground">
          No hay <b>cajas/puntos</b> para esta unidad.
        </p>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">POS Restaurante</h1>
        <p className="text-sm text-muted-foreground">
          No hay <b>mesas</b> registradas para este filtro.
        </p>
      </div>
    );
  }

  if (menu.length === 0) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">POS Restaurante</h1>
        <p className="text-sm text-muted-foreground">
          No hay <b>productos</b> en el menú para esta unidad/caja.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">POS Restaurante</h1>
          <p className="text-sm text-muted-foreground">Flujo rápido: Mesa → Orden → Agregar → Enviar cocina → Cobrar</p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {me.allowedToSwitch ? (
            <div className="min-w-[260px]">
              <Select value={businessId} onValueChange={onBusinessChange}>
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
            </div>
          ) : (
            <Badge variant="secondary">Unidad fija (staff)</Badge>
          )}

          <div className="min-w-[240px]">
            <Select value={cashpointId} onValueChange={onCashpointChange}>
              <SelectTrigger>
                <SelectValue placeholder="Caja / Local" />
              </SelectTrigger>
              <SelectContent>
                {cashpoints.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">
              Rancho: separa <b>Los Jabalíes</b> vs <b>Cantina</b>.
            </div>
          </div>

          <div className="min-w-[220px]">
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concepto (ej. Cantina)" />
            <div className="text-xs text-muted-foreground mt-1">Se guarda en la venta contable.</div>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
        {/* TABLES */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {tables.map((t: any) => {
                const active = t.id === tableId;
                return (
                  <Button
                    key={t.id}
                    variant={active ? "default" : "outline"}
                    className="h-14 justify-start"
                    onClick={() => selectTable(t.id)}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs opacity-80">Cap {t.capacity}</span>
                    </div>
                  </Button>
                );
              })}
            </div>

            <Separator className="my-2" />
            <div className="text-xs text-muted-foreground">Tip: selecciona mesa y ya puedes cobrar / mandar cocina.</div>
          </CardContent>
        </Card>

        {/* MENU */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Menú</CardTitle>
              {!tableId ? <Badge variant="secondary">Selecciona mesa</Badge> : <Badge variant="secondary">Mesa activa</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="flex flex-wrap h-auto">
                {categories.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {menuByCategory.map((m: any) => (
                <Button
                  key={m.id}
                  variant="outline"
                  className="h-auto py-3 px-3 justify-start"
                  disabled={!tableId || !order?.id}
                  onClick={() => add(m.id)}
                >
                  <div className="flex flex-col items-start">
                    <div className="font-medium leading-tight">{m.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{mxn(m.priceCents / 100)}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TICKET */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Ticket</CardTitle>
              {tableId ? <Badge variant="secondary">Mesa</Badge> : <Badge variant="secondary">—</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!order?.id ? (
              <div className="text-sm text-muted-foreground">Selecciona una mesa para iniciar.</div>
            ) : (
              <>
                <div className="text-sm">
                  <div className="font-medium">{order.table?.name ? `Mesa: ${order.table.name}` : "Orden"}</div>
                  <div className="text-xs text-muted-foreground">
                    Estado: <span className="font-medium">{order.status}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                  {order.items?.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Agrega productos del menú.</div>
                  ) : (
                    order.items.map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{it.menuItem?.name ?? "Producto"}</div>
                          <div className="text-xs text-muted-foreground">
                            {mxn((it.priceCents || 0) / 100)} · {it.kitchenStatus}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => dec(it.id, it.qty)}>
                            –
                          </Button>
                          <div className="w-8 text-center text-sm font-semibold">{it.qty}</div>
                          <Button variant="outline" size="icon" onClick={() => inc(it.id, it.qty)}>
                            +
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-lg font-semibold">{mxn(totalOrder(order.items || []))}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={sendKitchen} disabled={(order.items?.length || 0) === 0}>
                    Enviar a cocina
                  </Button>

                  <Dialog open={payOpen} onOpenChange={setPayOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={(order.items?.length || 0) === 0}>Cobrar</Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cobrar orden</DialogTitle>
                      </DialogHeader>

                      <div className="space-y-3">
                        <div className="text-sm">
                          Total: <span className="font-semibold">{mxn(totalOrder(order.items || []))}</span>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Método de pago</div>
                          <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                              <SelectItem value={PaymentMethod.CARD}>Tarjeta</SelectItem>
                              <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button onClick={pay} className="w-full">
                          Confirmar cobro
                        </Button>

                        <div className="text-xs text-muted-foreground">
                          Esto cierra la orden y genera una venta contable (Sale) en la unidad/caja seleccionada.
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UtensilsCrossed, DollarSign, ClipboardList,
  Users, AlertTriangle, ArrowRight, CheckSquare,
  TrendingUp, ShoppingCart
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export default async function RestaurantManagerDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const businessId = user.primaryBusinessId as string | null;

  // Fechas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  // ── Ventas del día ──────────────────────────────────────────────
  const salesAgg = await prisma.sale.aggregate({
    where: {
      createdAt: { gte: today },
      ...(businessId ? { businessId } : {}),
    },
    _sum: { amountCents: true },
    _count: true,
  });
  const salesToday = salesAgg._sum.amountCents ?? 0;
  const txCount = salesAgg._count;

  // ── Órdenes activas (OPEN o SENT) ──────────────────────────────
  const activeOrders = await prisma.restaurantOrder.findMany({
    where: {
      status: { in: ["OPEN", "SENT"] },
      ...(businessId ? { businessId } : {}),
    },
    include: {
      table: { select: { name: true } },
      items: { select: { id: true, kitchenStatus: true } },
    },
    orderBy: { openedAt: "asc" },
    take: 8,
  });

  // ── Mesas con orden activa ──────────────────────────────────────
  const occupiedTableIds = new Set(activeOrders.map(o => o.tableId));

  const allTables = await prisma.restaurantTable.count({
    where: { isActive: true, ...(businessId ? { businessId } : {}) },
  });

  // ── Tareas pendientes de este negocio ───────────────────────────
  const pendingTasks = await prisma.task.count({
    where: {
      status: { in: ["TODO", "DOING", "BLOCKED"] },
      ...(businessId ? { businessId } : {}),
    },
  });

  // ── Retiros pendientes ──────────────────────────────────────────
  const pendingWithdrawals = await prisma.withdrawal.count({
    where: {
      status: "REQUESTED",
      ...(businessId ? { businessId } : {}),
    },
  });

  // ── Personal en turno (de este negocio) ────────────────────────
  const staffOnShift = await prisma.workDay.count({
    where: {
      date: { gte: today },
      status: { in: ["OPEN", "NEEDS_REVIEW"] },
      user: businessId ? { businessId } : undefined,
    },
  });

  // ── Gastos del día ──────────────────────────────────────────────
  const expAgg = await prisma.expense.aggregate({
    where: {
      createdAt: { gte: today },
      ...(businessId ? { businessId } : {}),
    },
    _sum: { amountCents: true },
  });
  const expensesToday = expAgg._sum.amountCents ?? 0;

  // ── Productos en alerta de stock ────────────────────────────────
  const lowStock = await prisma.inventoryItem.count({
    where: {
      isActive: true,
      ...(businessId ? { businessId } : {}),
    },
  }).then(async () => {
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true, ...(businessId ? { businessId } : {}) },
      select: { onHandQty: true, minQty: true },
    });
    return items.filter(i => i.onHandQty <= i.minQty).length;
  });

  const minutesOpen = (order: (typeof activeOrders)[0]) =>
    Math.floor((now.getTime() - order.openedAt.getTime()) / 60000);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola, {user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Panel de operación — {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/restaurant/pos">
              <ShoppingCart className="w-4 h-4 mr-1.5" /> Abrir POS
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/restaurant/tables">
              <UtensilsCrossed className="w-4 h-4 mr-1.5" /> Mesas
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">{txCount} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Mesas activas</CardTitle>
            <UtensilsCrossed className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{occupiedTableIds.size} / {allTables}</div>
            <p className="text-xs text-muted-foreground">{activeOrders.length} órdenes abiertas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Personal</CardTitle>
            <Users className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{staffOnShift}</div>
            <p className="text-xs text-muted-foreground">Empleados en turno</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gastos hoy</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(expensesToday)}</div>
            <p className="text-xs text-muted-foreground">Egresos registrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Órdenes activas */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Órdenes activas
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/restaurant/tables">
                  Ver mesas <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No hay órdenes abiertas en este momento.
              </div>
            ) : (
              <div className="divide-y">
                {activeOrders.map(order => {
                  const mins = minutesOpen(order);
                  const isLong = mins > 45;
                  const pendingItems = order.items.filter(i =>
                    i.kitchenStatus === "NEW" || i.kitchenStatus === "PREPARING"
                  ).length;

                  return (
                    <div key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${order.status === "OPEN" ? "bg-blue-400" : "bg-amber-400"}`} />
                        <div>
                          <p className="text-sm font-medium">{order.table?.name ?? "Sin mesa"}</p>
                          <p className="text-xs text-muted-foreground">{order.items.length} productos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingItems > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {pendingItems} en cocina
                          </Badge>
                        )}
                        <span className={`text-xs font-medium ${isLong ? "text-red-500" : "text-muted-foreground"}`}>
                          {mins} min
                        </span>
                        <Badge variant={order.status === "OPEN" ? "outline" : "secondary"} className="text-xs">
                          {order.status === "OPEN" ? "Abierta" : "Enviada"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Alertas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingWithdrawals > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-orange-500" />
                  <span>{pendingWithdrawals} retiro(s) pendiente(s)</span>
                  <Link href="/app/owner/withdrawals" className="ml-auto text-orange-600 hover:underline text-xs font-medium">
                    Ver
                  </Link>
                </div>
              )}
              {lowStock > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{lowStock} producto(s) bajo mínimo</span>
                  <Link href="/app/inventory" className="ml-auto text-red-600 hover:underline text-xs font-medium">
                    Ver
                  </Link>
                </div>
              )}
              {pendingTasks > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                  <CheckSquare className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>{pendingTasks} tarea(s) pendiente(s)</span>
                  <Link href="/app/ops/kanban/activities" className="ml-auto text-amber-600 hover:underline text-xs font-medium">
                    Ver
                  </Link>
                </div>
              )}
              {pendingWithdrawals === 0 && lowStock === 0 && pendingTasks === 0 && (
                <p className="text-muted-foreground text-xs text-center py-2">Todo en orden ✓</p>
              )}
            </CardContent>
          </Card>

          {/* Accesos rápidos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "KDS Cocina", href: "/app/restaurant/kds" },
                { label: "Menú", href: "/app/restaurant/menu" },
                { label: "Inventario", href: "/app/inventory" },
                { label: "Requisición", href: "/app/inventory/requisitions/new" },
                { label: "Asistencias", href: "/app/payroll" },
                { label: "Tareas", href: "/app/ops/kanban/activities" },
              ].map(item => (
                <Button key={item.href} variant="outline" size="sm" className="h-10 text-xs" asChild>
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
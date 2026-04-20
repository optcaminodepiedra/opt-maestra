import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, TrendingUp, BedDouble, ArrowRight, DollarSign, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export default async function OwnerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userName = session.user.name?.split(" ")[0] || "Equipo";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Personal en turno
  const activeStaff = await prisma.workDay.count({
    where: {
      date: { gte: today },
      status: { in: ["OPEN", "NEEDS_REVIEW"] },
    },
  });

  // Tareas pendientes (toda la operadora)
  const pendingTasks = await prisma.task.count({
    where: { status: { in: ["TODO", "DOING", "BLOCKED"] } },
  });

  // Ventas reales del día (todos los negocios)
  const salesAgg = await prisma.sale.aggregate({
    where: { createdAt: { gte: today } },
    _sum: { amountCents: true },
  });
  const salesToday = salesAgg._sum.amountCents ?? 0;

  // Habitaciones ocupadas (reservaciones con check-in activo)
  const occupiedRooms = await prisma.hotelReservation.count({
    where: { status: "CHECKED_IN" },
  });
  const totalRooms = await prisma.hotelRoom.count({
    where: { isActive: true },
  });

  // Retiros pendientes de aprobación
  const pendingWithdrawals = await prisma.withdrawal.count({
    where: { status: "REQUESTED" },
  });

  // Productos en alerta de stock
  const allItems = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    select: { onHandQty: true, minQty: true },
  });
  const lowStockCount = allItems.filter(i => i.onHandQty <= i.minQty).length;

  // Órdenes de restaurante activas
  const activeOrders = await prisma.restaurantOrder.count({
    where: { status: { in: ["OPEN", "SENT"] } },
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hola, {userName} 👋</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Resumen operativo de toda la operadora ·{" "}
          {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas del día</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">Todos los negocios</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Personal en turno</CardTitle>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{activeStaff}</div>
            <p className="text-xs text-muted-foreground">Empleados activos ahora</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ocupación hotel</CardTitle>
            <BedDouble className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{occupiedRooms} / {totalRooms}</div>
            <p className="text-xs text-muted-foreground">Habitaciones ocupadas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tareas pendientes</CardTitle>
            <CheckSquare className="h-3.5 w-3.5 text-orange-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{pendingTasks}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>
      </div>

      {/* Sección inferior */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Accesos rápidos */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Mapa de mesas", href: "/app/restaurant/tables", desc: `${activeOrders} órdenes activas` },
              { label: "Reservaciones hotel", href: "/app/hotel/reservations", desc: `${occupiedRooms} habitaciones ocupadas` },
              { label: "Control de asistencias", href: "/app/payroll", desc: `${activeStaff} en turno hoy` },
              { label: "Tablero de tareas", href: "/app/ops/kanban/activities", desc: `${pendingTasks} pendientes` },
              { label: "Inventario", href: "/app/inventory", desc: lowStockCount > 0 ? `⚠ ${lowStockCount} alertas` : "Sin alertas" },
              { label: "Usuarios", href: "/app/owner/users", desc: "Directorio del equipo" },
            ].map(item => (
              <Button
                key={item.href}
                variant="outline"
                className="h-16 flex flex-col items-start justify-center gap-0.5 px-4 hover:border-primary hover:text-primary transition-colors"
                asChild
              >
                <Link href={item.href}>
                  <span className="font-semibold text-sm">{item.label}</span>
                  <span className="text-xs text-muted-foreground font-normal">{item.desc}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Alertas operativas */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Alertas operativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWithdrawals > 0 && (
              <div className="flex items-center gap-3 text-sm p-3 bg-orange-50 text-orange-800 rounded-lg border border-orange-100">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <span>{pendingWithdrawals} retiro(s) de caja esperando autorización.</span>
                <Link href="/app/owner/withdrawals" className="ml-auto flex items-center gap-1 text-orange-600 font-semibold hover:underline shrink-0">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {lowStockCount > 0 && (
              <div className="flex items-center gap-3 text-sm p-3 bg-red-50 text-red-800 rounded-lg border border-red-100">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <span>{lowStockCount} producto(s) bajo el mínimo de inventario.</span>
                <Link href="/app/inventory" className="ml-auto flex items-center gap-1 text-red-600 font-semibold hover:underline shrink-0">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeStaff > 0 && (
              <div className="flex items-center gap-3 text-sm p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                <Users className="h-4 w-4 text-blue-500 shrink-0" />
                <span>{activeStaff} empleado(s) trabajando ahora.</span>
                <Link href="/app/payroll" className="ml-auto flex items-center gap-1 text-blue-600 font-semibold hover:underline shrink-0">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeOrders > 0 && (
              <div className="flex items-center gap-3 text-sm p-3 bg-purple-50 text-purple-800 rounded-lg border border-purple-100">
                <TrendingUp className="h-4 w-4 text-purple-500 shrink-0" />
                <span>{activeOrders} orden(es) activas en restaurante.</span>
                <Link href="/app/restaurant/tables" className="ml-auto flex items-center gap-1 text-purple-600 font-semibold hover:underline shrink-0">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {pendingWithdrawals === 0 && lowStockCount === 0 && activeStaff === 0 && (
              <div className="flex items-center justify-center text-xs text-muted-foreground p-6 border border-dashed rounded-lg">
                Todo en calma por ahora.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
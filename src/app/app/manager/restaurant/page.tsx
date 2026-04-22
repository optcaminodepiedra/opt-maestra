import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UtensilsCrossed, DollarSign, ClipboardList, Users, AlertTriangle, ArrowRight,
  CheckSquare, TrendingUp, ShoppingCart, Calendar, Package, Building2, Utensils,
  TrendingDown, FileText,
} from "lucide-react";
import Link from "next/link";
import { TodayShiftPanel } from "@/components/manager/TodayShiftPanel";
import { WithdrawalActions } from "@/components/manager/WithdrawalActions";
import { FoodServicePanel } from "@/components/manager/FoodServicePanel";
import { getShiftsForDay, getCandidateUsersForBusiness, isoDate, dateOnly } from "@/lib/schedule";
import { getFoodServicePax } from "@/lib/food-service";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);

export default async function RestaurantManagerDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; name?: string; role?: string; primaryBusinessId?: string | null };
  const businessId = u.primaryBusinessId;
  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin negocio asignado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que configure tu negocio principal.
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = u.name?.split(" ")[0] ?? "Gerente";
  const todayIso = isoDate();
  const today = dateOnly(todayIso);
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, linkedHotelBusinessId: true, linkedHotel: { select: { id: true, name: true } } },
  });
  if (!business) redirect("/app");

  const whereByBiz = { businessId };

  const [
    salesTodayAgg, salesMonthAgg, expTodayAgg, pendingTasks,
    pendingPettyWithdrawals, pendingLargeWithdrawals,
    activeOrders, totalTables, occupiedTablesRaw,
    staffOnShift, pendingRequisitions, cashpoints, invItems,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: { ...whereByBiz, createdAt: { gte: todayLocal } }, _sum: { amountCents: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...whereByBiz, createdAt: { gte: startOfMonth } }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ where: { ...whereByBiz, createdAt: { gte: todayLocal } }, _sum: { amountCents: true } }),
    prisma.task.count({ where: { ...whereByBiz, status: { in: ["TODO", "DOING", "BLOCKED"] } } }),
    prisma.withdrawal.count({ where: { ...whereByBiz, status: "APPROVED", createdAt: { gte: todayLocal } } }),
    prisma.withdrawal.count({ where: { ...whereByBiz, status: "REQUESTED" } }),
    prisma.restaurantOrder.findMany({
      where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } },
      include: { table: { select: { name: true } }, items: { select: { id: true, kitchenStatus: true } } },
      orderBy: { openedAt: "asc" }, take: 8,
    }),
    prisma.restaurantTable.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.restaurantOrder.findMany({ where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } }, select: { tableId: true }, distinct: ["tableId"] }),
    prisma.workDay.count({ where: { date: today, status: { in: ["OPEN", "NEEDS_REVIEW"] }, user: { businessId } } }),
    prisma.requisition.count({ where: { ...whereByBiz, status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"] } } }),
    prisma.cashpoint.findMany({ where: { businessId }, select: { id: true, name: true, businessId: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ where: { ...whereByBiz, isActive: true }, select: { id: true, name: true, onHandQty: true, minQty: true, businessId: true } }),
  ]);

  const salesToday = salesTodayAgg._sum.amountCents ?? 0;
  const salesMonth = salesMonthAgg._sum.amountCents ?? 0;
  const expensesToday = expTodayAgg._sum.amountCents ?? 0;
  const occupiedTables = occupiedTablesRaw.length;
  const lowStockItems = invItems.filter((i) => i.onHandQty <= i.minQty);
  const now = new Date();

  const foodServiceDays = business.linkedHotelBusinessId
    ? await getFoodServicePax(business.linkedHotelBusinessId, 7)
    : [];

  const [todayShifts, candidates] = await Promise.all([
    getShiftsForDay(businessId, todayIso),
    getCandidateUsersForBusiness(businessId),
  ]);

  const minutesOpen = (order: { openedAt: Date }) =>
    Math.floor((now.getTime() - new Date(order.openedAt).getTime()) / 60000);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panel de operación · {todayLocal.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" /> {business.name}
            </Badge>
            {business.linkedHotel && business.linkedHotel.id !== business.id && (
              <Badge variant="outline" className="text-xs">
                <Utensils className="w-3 h-3 mr-1" /> Sirve a {business.linkedHotel.name}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/restaurant/reports"><FileText className="w-4 h-4 mr-1.5" /> Reportes</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/restaurant/tables"><UtensilsCrossed className="w-4 h-4 mr-1.5" /> Mesas</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">{salesTodayAgg._count} tx · {fmt(salesMonth)} mes</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Mesas activas</CardTitle>
            <UtensilsCrossed className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{occupiedTables} / {totalTables}</div>
            <p className="text-xs text-muted-foreground">{activeOrders.length} órdenes abiertas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Personal en turno</CardTitle>
            <Users className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{staffOnShift}</div>
            <p className="text-xs text-muted-foreground">Empleados activos ahora</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gastos hoy</CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(expensesToday)}</div>
            <p className="text-xs text-muted-foreground">{pendingPettyWithdrawals} retiros caja chica</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Órdenes activas</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/restaurant/tables">Ver mesas <ArrowRight className="w-3 h-3 ml-1" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activeOrders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No hay órdenes abiertas en este momento.</div>
              ) : (
                <div className="divide-y">
                  {activeOrders.map((order) => {
                    const mins = minutesOpen(order);
                    const isLong = mins > 45;
                    const pendingItems = order.items.filter((i) => i.kitchenStatus === "NEW" || i.kitchenStatus === "PREPARING").length;
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
                          {pendingItems > 0 && <Badge variant="secondary" className="text-xs">{pendingItems} en cocina</Badge>}
                          <span className={`text-xs font-medium ${isLong ? "text-red-500" : "text-muted-foreground"}`}>{mins} min</span>
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

          {foodServiceDays.length > 0 && business.linkedHotel && (
            <FoodServicePanel hotelName={business.linkedHotel.name} days={foodServiceDays} />
          )}

          <TodayShiftPanel
            businessId={business.id}
            businessName={business.name}
            dateIso={todayIso}
            shifts={todayShifts}
            candidates={candidates.map((c) => ({ id: c.id, fullName: c.fullName, username: c.username, jobTitle: c.jobTitle, role: c.role as string }))}
          />
        </div>

        <div className="space-y-4">
          <WithdrawalActions businesses={[{ id: business.id, name: business.name }]} cashpoints={cashpoints} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingLargeWithdrawals > 0 && <AlertRow tone="orange" text={`${pendingLargeWithdrawals} retiro(s) pendiente(s)`} href="/app/manager/restaurant/finances" />}
              {lowStockItems.length > 0 && <AlertRow tone="red" text={`${lowStockItems.length} producto(s) bajo mínimo`} href="/app/manager/restaurant/inventory" />}
              {pendingTasks > 0 && <AlertRow tone="amber" text={`${pendingTasks} tarea(s) pendiente(s)`} href="/app/ops/kanban/activities" />}
              {pendingLargeWithdrawals === 0 && lowStockItems.length === 0 && pendingTasks === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Todo en orden ✓</p>
              )}
            </CardContent>
          </Card>

          {lowStockItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-red-500" /> Stock crítico</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <p className="font-medium truncate text-xs flex-1 min-w-0">{item.name}</p>
                      <Badge variant="destructive" className="text-[10px] shrink-0 ml-2">{item.onHandQty} / {item.minQty}</Badge>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <Link href={`/app/manager/restaurant/requisitions/new?businessId=${business.id}`}>
                      <Package className="w-3 h-3 mr-1" /> Pedir insumos
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Accesos rápidos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/restaurant/finances"><DollarSign className="w-3.5 h-3.5 mr-1.5" /> Finanzas</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/restaurant/payroll"><Users className="w-3.5 h-3.5 mr-1.5" /> Equipo</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/restaurant/kds"><UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" /> KDS</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/restaurant/menu"><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Menú</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href={`/app/manager/restaurant/requisitions/new?businessId=${business.id}`}>
                  <Package className="w-3.5 h-3.5 mr-1.5" /> Pedir
                  {pendingRequisitions > 0 && <Badge variant="secondary" className="ml-1 text-[9px]">{pendingRequisitions}</Badge>}
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/restaurant/schedule"><Calendar className="w-3.5 h-3.5 mr-1.5" /> Horarios</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ tone, text, href }: { tone: "orange" | "red" | "amber"; text: string; href: string }) {
  const toneClasses = {
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`flex items-center gap-2 p-2.5 border rounded-lg text-xs ${toneClasses[tone]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <Link href={href} className="font-semibold hover:underline text-[11px] shrink-0">Ver →</Link>
    </div>
  );
}

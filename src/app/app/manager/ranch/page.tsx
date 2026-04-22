import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DollarSign, Users, BedDouble, TrendingDown, AlertTriangle, ArrowRight,
  CheckSquare, UtensilsCrossed, Sparkles, Building2, ClipboardList, Package,
  Mountain, Calendar, ShoppingCart, FileText,
} from "lucide-react";
import { TodayShiftPanel } from "@/components/manager/TodayShiftPanel";
import { WithdrawalActions } from "@/components/manager/WithdrawalActions";
import { FoodServicePanel } from "@/components/manager/FoodServicePanel";
import {
  getShiftsForDay,
  getCandidateUsersForBusiness,
  isoDate,
  dateOnly,
} from "@/lib/schedule";
import { getFoodServicePax } from "@/lib/food-service";
import { resolveManagerScope } from "@/lib/manager-scope";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default async function ManagerRanchDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const scope = await resolveManagerScope("ranch");
  const firstName = scope.userName.split(" ")[0];

  if (scope.businesses.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin negocios asignados</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne un negocio.
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = scope.businesses[0];
  const businessId = business.id;
  const todayIso = isoDate();
  const today = dateOnly(todayIso);
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
  const tomorrowLocal = new Date(todayLocal.getTime() + 24 * 3600 * 1000);

  const whereByBiz = { businessId };

  const [
    salesTodayAgg, salesMonthAgg, expTodayAgg, pendingTasks,
    pendingPettyWithdrawals, pendingLargeWithdrawals,
    activeOrdersCount, totalTables, occupiedTablesRaw,
    occupiedRooms, totalRooms, roomsDirty, todayCheckIns, todayCheckOuts,
    pendingRequisitions, staffOnShift, cashpoints, invItems,
    rancherActivities,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...whereByBiz, createdAt: { gte: todayLocal } },
      _sum: { amountCents: true }, _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...whereByBiz, createdAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ...whereByBiz, createdAt: { gte: todayLocal } },
      _sum: { amountCents: true },
    }),
    prisma.task.count({
      where: { ...whereByBiz, status: { in: ["TODO", "DOING", "BLOCKED"] } },
    }),
    prisma.withdrawal.count({
      where: { ...whereByBiz, status: "APPROVED", createdAt: { gte: todayLocal } },
    }),
    prisma.withdrawal.count({
      where: { ...whereByBiz, status: "REQUESTED" },
    }),
    prisma.restaurantOrder.count({
      where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } },
    }),
    prisma.restaurantTable.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.restaurantOrder.findMany({
      where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } },
      select: { tableId: true }, distinct: ["tableId"],
    }),
    prisma.hotelReservation.count({
      where: { ...whereByBiz, status: "CHECKED_IN" },
    }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.hotelRoom.count({
      where: { ...whereByBiz, isActive: true, status: "DIRTY" },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz, status: { in: ["CONFIRMED", "PENDING"] },
        checkIn: { gte: todayLocal, lt: tomorrowLocal },
      },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz, status: "CHECKED_IN",
        checkOut: { gte: todayLocal, lt: tomorrowLocal },
      },
    }),
    prisma.requisition.count({
      where: { ...whereByBiz, status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"] } },
    }),
    prisma.workDay.count({
      where: { date: today, status: { in: ["OPEN", "NEEDS_REVIEW"] }, user: { businessId } },
    }),
    prisma.cashpoint.findMany({
      where: { businessId },
      select: { id: true, name: true, businessId: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { ...whereByBiz, isActive: true },
      select: { id: true, name: true, onHandQty: true, minQty: true, businessId: true },
    }),
    // Experiencias del rancho: usamos Task con area="OPERATIONS" como placeholder
    // (en el futuro puede ser un modelo Activity propio)
    prisma.task.count({
      where: { ...whereByBiz, type: "ACTIVITY", status: { in: ["TODO", "DOING"] } },
    }),
  ]);

  const salesToday = salesTodayAgg._sum.amountCents ?? 0;
  const salesMonth = salesMonthAgg._sum.amountCents ?? 0;
  const expensesToday = expTodayAgg._sum.amountCents ?? 0;
  const occupiedTables = occupiedTablesRaw.length;
  const lowStockItems = invItems.filter((i) => i.onHandQty <= i.minQty);
  const hasHotel = totalRooms > 0;
  const hasRestaurant = totalTables > 0;

  // Comensales 7 días
  const foodServiceDays = business.linkedHotelBusinessId
    ? await getFoodServicePax(business.linkedHotelBusinessId, 7)
    : [];

  // Plantilla
  const [todayShifts, candidates] = await Promise.all([
    getShiftsForDay(businessId, todayIso),
    getCandidateUsersForBusiness(businessId),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Hola, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rancho El Milagrito ·{" "}
            {todayLocal.toLocaleDateString("es-MX", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary" className="text-xs">
              <Building2 className="w-3 h-3 mr-1" /> {business.name}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Mountain className="w-3 h-3 mr-1" /> Experiencias
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ranch/reports">
              <FileText className="w-4 h-4 mr-1.5" /> Reportes
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/manager/ranch/schedule">
              <Calendar className="w-4 h-4 mr-1.5" /> Programar turnos
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">
              {salesTodayAgg._count} tx · {fmt(salesMonth)} mes
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Experiencias</CardTitle>
            <Mountain className="h-3.5 w-3.5 text-amber-600" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{rancherActivities}</div>
            <p className="text-xs text-muted-foreground">Activas en ejecución</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {hasHotel ? "Ocupación" : "Mesas activas"}
            </CardTitle>
            {hasHotel ? <BedDouble className="h-3.5 w-3.5 text-purple-500" /> : <UtensilsCrossed className="h-3.5 w-3.5 text-purple-500" />}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">
              {hasHotel ? `${occupiedRooms} / ${totalRooms}` : `${occupiedTables} / ${totalTables}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasHotel ? `${todayCheckIns} llegan · ${todayCheckOuts} salen` : `${activeOrdersCount} órdenes abiertas`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Personal en turno</CardTitle>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{staffOnShift}</div>
            <p className="text-xs text-muted-foreground">Empleados activos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Operación */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Operación del día
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Experiencias del rancho */}
              <div className="border rounded-lg p-4 space-y-2 bg-amber-50/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold">Experiencias del rancho</h3>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/app/adventure">
                      Ver actividades <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Activas</p>
                    <p className="font-semibold">{rancherActivities}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Huéspedes</p>
                    <p className="font-semibold">{occupiedRooms}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Personal campo</p>
                    <p className="font-semibold">{staffOnShift}</p>
                  </div>
                </div>
              </div>

              {/* Hotel */}
              {hasHotel && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-purple-500" />
                      <h3 className="text-sm font-semibold">Hotel / Glamping</h3>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/app/hotel/frontdesk">
                        Front Desk <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Llegadas hoy</p><p className="font-semibold">{todayCheckIns}</p></div>
                    <div><p className="text-xs text-muted-foreground">Salidas hoy</p><p className="font-semibold">{todayCheckOuts}</p></div>
                    <div><p className="text-xs text-muted-foreground">Por limpiar</p><p className={`font-semibold ${roomsDirty > 0 ? "text-amber-600" : ""}`}>{roomsDirty}</p></div>
                    <div><p className="text-xs text-muted-foreground">Ocupación</p><p className="font-semibold">{totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0}%</p></div>
                  </div>
                </div>
              )}

              {/* Restaurante */}
              {hasRestaurant && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                      <h3 className="text-sm font-semibold">Restaurante</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/kds">KDS</Link></Button>
                      <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/tables">Mesas</Link></Button>
                      <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/pos">POS <ArrowRight className="w-3 h-3 ml-1" /></Link></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Mesas</p><p className="font-semibold">{occupiedTables} / {totalTables}</p></div>
                    <div><p className="text-xs text-muted-foreground">Órdenes</p><p className="font-semibold">{activeOrdersCount}</p></div>
                    <div><p className="text-xs text-muted-foreground">Ocupación</p><p className="font-semibold">{totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0}%</p></div>
                  </div>
                </div>
              )}

              {/* Inventario */}
              {invItems.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-semibold">Inventario</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/manager/ranch/requisitions">
                          Pedidos
                          {pendingRequisitions > 0 && (<Badge variant="secondary" className="ml-1 text-[10px]">{pendingRequisitions}</Badge>)}
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/manager/ranch/inventory">Stock <ArrowRight className="w-3 h-3 ml-1" /></Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Productos</p><p className="font-semibold">{invItems.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Bajo mínimo</p><p className={`font-semibold ${lowStockItems.length > 0 ? "text-red-600" : "text-green-600"}`}>{lowStockItems.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">Requisiciones</p><p className={`font-semibold ${pendingRequisitions > 0 ? "text-amber-600" : ""}`}>{pendingRequisitions}</p></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Servicio de alimentos */}
          {business.linkedHotelBusinessId && foodServiceDays.length > 0 && (
            <FoodServicePanel hotelName={business.name} days={foodServiceDays} />
          )}

          {/* Plantilla */}
          <TodayShiftPanel
            businessId={business.id}
            businessName={business.name}
            dateIso={todayIso}
            shifts={todayShifts}
            candidates={candidates.map((c) => ({
              id: c.id, fullName: c.fullName, username: c.username,
              jobTitle: c.jobTitle, role: c.role as string,
            }))}
          />
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          <WithdrawalActions
            businesses={[{ id: business.id, name: business.name }]}
            cashpoints={cashpoints}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingLargeWithdrawals > 0 && (
                <AlertRow tone="orange" text={`${pendingLargeWithdrawals} retiro(s) pendientes`} href="/app/owner/withdrawals" />
              )}
              {lowStockItems.length > 0 && (
                <AlertRow tone="red" text={`${lowStockItems.length} producto(s) bajo mínimo`} href="/app/manager/ranch/inventory" />
              )}
              {roomsDirty > 0 && (
                <AlertRow tone="amber" text={`${roomsDirty} habitación(es) por limpiar`} href="/app/hotel/housekeeping" />
              )}
              {pendingTasks > 0 && (
                <AlertRow tone="blue" text={`${pendingTasks} tarea(s) pendientes`} href="/app/ops/kanban/activities" />
              )}
              {pendingLargeWithdrawals === 0 && lowStockItems.length === 0 && roomsDirty === 0 && pendingTasks === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Todo en orden ✓</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/ranch/finances"><DollarSign className="w-3.5 h-3.5 mr-1.5" /> Finanzas</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/ranch/payroll"><Users className="w-3.5 h-3.5 mr-1.5" /> Equipo</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/ranch/requisitions/new"><Package className="w-3.5 h-3.5 mr-1.5" /> Pedir</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/adventure"><Mountain className="w-3.5 h-3.5 mr-1.5" /> Experiencias</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/ranch/reports"><FileText className="w-3.5 h-3.5 mr-1.5" /> Reportes</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/ops/kanban/activities"><CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Tareas</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ tone, text, href }: { tone: "orange" | "red" | "amber" | "blue"; text: string; href: string }) {
  const toneClasses = {
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
  };
  return (
    <div className={`flex items-center gap-2 p-2.5 border rounded-lg text-xs ${toneClasses[tone]}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <Link href={href} className="font-semibold hover:underline text-[11px] shrink-0">Ver →</Link>
    </div>
  );
}

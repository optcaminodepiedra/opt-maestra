import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DollarSign,
  Users,
  BedDouble,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  UtensilsCrossed,
  Sparkles,
  Building2,
  ClipboardList,
  Package,
  Flower2,
  ShoppingBag,
  Bath,
  ShoppingCart,
  Utensils,
  Calendar,
} from "lucide-react";
import { TodayShiftPanel } from "@/components/manager/TodayShiftPanel";
import { WithdrawalActions } from "@/components/manager/WithdrawalActions";
import {
  getShiftsForDay,
  getCandidateUsersForBusiness,
  isoDate,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(cents / 100);

/* ─── Resolver negocios que gestiona este usuario ─── */
async function getManagedBusinessIds(
  userId: string,
  primaryBusinessId: string | null
): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<{ businessId: string }[]>`
      SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
    `;
    if (rows.length > 0) {
      const ids = rows.map((r) => r.businessId);
      if (primaryBusinessId && !ids.includes(primaryBusinessId)) ids.push(primaryBusinessId);
      return ids;
    }
  } catch {
    /* tabla puede no existir aún */
  }
  return primaryBusinessId ? [primaryBusinessId] : [];
}

export default async function ManagerOpsDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as {
    id?: string;
    name?: string;
    role?: string;
    primaryBusinessId?: string | null;
  };
  const firstName = u.name?.split(" ")[0] ?? "Gerente";

  const businessIds = await getManagedBusinessIds(
    u.id ?? "",
    u.primaryBusinessId ?? null
  );
  const todayIso = isoDate();
  const today = new Date(todayIso + "T00:00:00.000Z");
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
  const tomorrowLocal = new Date(todayLocal.getTime() + 24 * 3600 * 1000);

  if (businessIds.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin negocios asignados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu usuario no tiene un negocio principal configurado ni accesos múltiples. Pide a un
            administrador que te asigne al menos un negocio para poder ver tu panel de operación.
          </CardContent>
        </Card>
      </div>
    );
  }

  const whereByBiz = { businessId: { in: businessIds } };

  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [
    salesTodayAgg,
    salesMonthAgg,
    expTodayAgg,
    pendingTasks,
    pendingPettyWithdrawals,
    pendingLargeWithdrawals,
    activeOrdersCount,
    totalTables,
    occupiedTablesRaw,
    occupiedRooms,
    totalRooms,
    roomsDirty,
    roomsMaintenance,
    todayCheckIns,
    todayCheckOuts,
    pendingRequisitions,
    foodReservationsToday,
    staffOnShift,
    cashpoints,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...whereByBiz, createdAt: { gte: todayLocal } },
      _sum: { amountCents: true },
      _count: true,
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
    prisma.restaurantTable.count({
      where: { ...whereByBiz, isActive: true },
    }),
    prisma.restaurantOrder.findMany({
      where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } },
      select: { tableId: true },
      distinct: ["tableId"],
    }),
    prisma.hotelReservation.count({
      where: { ...whereByBiz, status: "CHECKED_IN" },
    }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.hotelRoom.count({
      where: { ...whereByBiz, isActive: true, status: "DIRTY" },
    }),
    prisma.hotelRoom.count({
      where: {
        ...whereByBiz,
        isActive: true,
        status: { in: ["MAINTENANCE", "OUT_OF_SERVICE"] },
      },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz,
        status: { in: ["CONFIRMED", "PENDING"] },
        checkIn: { gte: todayLocal, lt: tomorrowLocal },
      },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz,
        status: "CHECKED_IN",
        checkOut: { gte: todayLocal, lt: tomorrowLocal },
      },
    }),
    prisma.requisition.count({
      where: {
        ...whereByBiz,
        status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"] },
      },
    }),
    prisma.hotelReservation.findMany({
      where: {
        ...whereByBiz,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          { checkIn: { gte: todayLocal, lt: tomorrowLocal } },
          {
            AND: [
              { checkIn: { lte: todayLocal } },
              { checkOut: { gte: todayLocal } },
            ],
          },
        ],
        notes: { contains: "aliment", mode: "insensitive" },
      },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { name: true } },
      },
      take: 10,
      orderBy: { checkIn: "asc" },
    }),
    prisma.workDay.count({
      where: {
        date: today,
        status: { in: ["OPEN", "NEEDS_REVIEW"] },
        user: { businessId: { in: businessIds } },
      },
    }),
    prisma.cashpoint.findMany({
      where: { businessId: { in: businessIds } },
      select: { id: true, name: true, businessId: true },
      orderBy: [{ businessId: "asc" }, { name: "asc" }],
    }),
  ]);

  const salesToday = salesTodayAgg._sum.amountCents ?? 0;
  const salesMonth = salesMonthAgg._sum.amountCents ?? 0;
  const expensesToday = expTodayAgg._sum.amountCents ?? 0;
  const occupiedTables = occupiedTablesRaw.length;
  const hasRestaurant = totalTables > 0;
  const hasHotel = totalRooms > 0;

  const invItems = await prisma.inventoryItem.findMany({
    where: { ...whereByBiz, isActive: true },
    select: { id: true, name: true, onHandQty: true, minQty: true, businessId: true },
  });
  const lowStockItems = invItems.filter((i) => i.onHandQty <= i.minQty);

  const salesByBusiness =
    businessIds.length > 1
      ? await prisma.sale.groupBy({
          by: ["businessId"],
          where: { ...whereByBiz, createdAt: { gte: todayLocal } },
          _sum: { amountCents: true },
          _count: true,
        })
      : [];

  const shiftsByBusiness = await Promise.all(
    businesses.map(async (b) => ({
      business: b,
      shifts: await getShiftsForDay(b.id, todayIso),
      candidates: await getCandidateUsersForBusiness(b.id),
    }))
  );

  const bizName = (id: string) =>
    businesses.find((b) => b.id === id)?.name ?? "Negocio";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Hola, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panel de gerencia ·{" "}
            {todayLocal.toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {businesses.map((b) => (
              <Badge key={b.id} variant="secondary" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" /> {b.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/reports">
              <ClipboardList className="w-4 h-4 mr-1.5" /> Reportes
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/app/manager/schedule?businessId=${businesses[0]?.id ?? ""}`}>
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

        <Card className="border-l-4 border-l-blue-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Personal en turno</CardTitle>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{staffOnShift}</div>
            <p className="text-xs text-muted-foreground">Empleados activos ahora</p>
          </CardContent>
        </Card>

        {hasHotel ? (
          <Card className="border-l-4 border-l-purple-500 py-0">
            <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ocupación</CardTitle>
              <BedDouble className="h-3.5 w-3.5 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold">
                {occupiedRooms} / {totalRooms}
              </div>
              <p className="text-xs text-muted-foreground">
                {todayCheckIns} llegan · {todayCheckOuts} salen
              </p>
            </CardContent>
          </Card>
        ) : hasRestaurant ? (
          <Card className="border-l-4 border-l-purple-500 py-0">
            <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Mesas activas</CardTitle>
              <UtensilsCrossed className="h-3.5 w-3.5 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold">
                {occupiedTables} / {totalTables}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeOrdersCount} órdenes abiertas
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-purple-500 py-0">
            <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Productos</CardTitle>
              <Package className="h-3.5 w-3.5 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold">{invItems.length}</div>
              <p className="text-xs text-muted-foreground">En catálogo</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-red-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gastos hoy</CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(expensesToday)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingPettyWithdrawals} retiros caja chica
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Desglose por negocio */}
      {businessIds.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Ventas del día por negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {businesses.map((b) => {
                const row = salesByBusiness.find((r) => r.businessId === b.id);
                const amount = row?._sum.amountCents ?? 0;
                const count = row?._count ?? 0;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{count} transacciones</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmt(amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operación + panel lateral */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Operación del día
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasHotel && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-purple-500" />
                      <h3 className="text-sm font-semibold">Hotel</h3>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/app/hotel/frontdesk">
                        Front Desk <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <MiniStat label="Llegadas hoy" value={todayCheckIns} />
                    <MiniStat label="Salidas hoy" value={todayCheckOuts} />
                    <MiniStat
                      label="Por limpiar"
                      value={roomsDirty}
                      color={roomsDirty > 0 ? "text-amber-600" : undefined}
                    />
                    <MiniStat
                      label="Mantenimiento"
                      value={roomsMaintenance}
                      color={roomsMaintenance > 0 ? "text-red-600" : undefined}
                    />
                  </div>

                  {foodReservationsToday.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Utensils className="w-3.5 h-3.5 text-amber-700" />
                        <p className="text-xs font-semibold text-amber-900">
                          {foodReservationsToday.length} reservación(es) con servicio de alimentos
                        </p>
                      </div>
                      <ul className="space-y-1">
                        {foodReservationsToday.slice(0, 5).map((r) => (
                          <li key={r.id} className="text-xs text-amber-800">
                            <span className="font-medium">{r.guest.fullName}</span>
                            <span className="text-amber-700">
                              {" "}
                              · Hab. {r.room.name} ·{" "}
                              {new Date(r.checkIn).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                              })}
                              {" → "}
                              {new Date(r.checkOut).toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {foodReservationsToday.length > 5 && (
                        <Link
                          href="/app/hotel/reservations"
                          className="text-[11px] text-amber-700 underline mt-2 inline-block"
                        >
                          Ver todas →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}

              {hasRestaurant && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                      <h3 className="text-sm font-semibold">Restaurante</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/restaurant/kds">KDS</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/restaurant/tables">Mesas</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/restaurant/pos">
                          POS <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <MiniStat label="Mesas ocupadas" value={`${occupiedTables} / ${totalTables}`} />
                    <MiniStat label="Órdenes abiertas" value={activeOrdersCount} />
                    <MiniStat
                      label="Ocupación"
                      value={`${totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0}%`}
                    />
                  </div>
                </div>
              )}

              {invItems.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-semibold">Inventario</h3>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/inventory/requisitions">
                          Requisiciones
                          {pendingRequisitions > 0 && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">
                              {pendingRequisitions}
                            </Badge>
                          )}
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/app/inventory">
                          Stock <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <MiniStat label="Productos activos" value={invItems.length} />
                    <MiniStat
                      label="Bajo mínimo"
                      value={lowStockItems.length}
                      color={lowStockItems.length > 0 ? "text-red-600" : "text-green-600"}
                    />
                    <MiniStat
                      label="Requisiciones"
                      value={pendingRequisitions}
                      color={pendingRequisitions > 0 ? "text-amber-600" : undefined}
                    />
                  </div>
                </div>
              )}

              {/* Módulos extra: tienda, spa, baños */}
              <div className="grid grid-cols-3 gap-2">
                <QuickModuleCard
                  icon={<ShoppingBag className="w-4 h-4 text-purple-500" />}
                  label="Tienda"
                  href="/app/store"
                />
                <QuickModuleCard
                  icon={<Flower2 className="w-4 h-4 text-pink-500" />}
                  label="Spa"
                  href="/app/spa"
                />
                <QuickModuleCard
                  icon={<Bath className="w-4 h-4 text-sky-500" />}
                  label="Baños"
                  href="/app/facilities/bathrooms"
                />
              </div>
            </CardContent>
          </Card>

          {/* Plantilla por cada negocio */}
          {shiftsByBusiness.map(({ business, shifts, candidates }) => (
            <TodayShiftPanel
              key={business.id}
              businessId={business.id}
              businessName={business.name}
              dateIso={todayIso}
              shifts={shifts}
              candidates={candidates.map((c) => ({
                id: c.id,
                fullName: c.fullName,
                username: c.username,
                jobTitle: c.jobTitle,
                role: c.role as string,
              }))}
            />
          ))}
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          <WithdrawalActions businesses={businesses} cashpoints={cashpoints} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingLargeWithdrawals > 0 && (
                <AlertRow
                  tone="orange"
                  icon={<AlertTriangle className="w-4 h-4 shrink-0 text-orange-500" />}
                  text={`${pendingLargeWithdrawals} retiro(s) pendientes de aprobación`}
                  href="/app/owner/withdrawals"
                />
              )}
              {lowStockItems.length > 0 && (
                <AlertRow
                  tone="red"
                  icon={<AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />}
                  text={`${lowStockItems.length} producto(s) bajo mínimo`}
                  href="/app/inventory"
                />
              )}
              {roomsDirty > 0 && (
                <AlertRow
                  tone="amber"
                  icon={<BedDouble className="w-4 h-4 shrink-0 text-amber-500" />}
                  text={`${roomsDirty} habitación(es) por limpiar`}
                  href="/app/hotel/housekeeping"
                />
              )}
              {pendingTasks > 0 && (
                <AlertRow
                  tone="blue"
                  icon={<CheckSquare className="w-4 h-4 shrink-0 text-blue-500" />}
                  text={`${pendingTasks} tarea(s) pendientes`}
                  href="/app/ops/kanban/activities"
                />
              )}
              {pendingLargeWithdrawals === 0 &&
                lowStockItems.length === 0 &&
                roomsDirty === 0 &&
                pendingTasks === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Todo en orden ✓
                  </p>
                )}
            </CardContent>
          </Card>

          {lowStockItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-red-500" /> Stock crítico
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-2.5 flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate text-xs">{item.name}</p>
                        {businessIds.length > 1 && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {bizName(item.businessId)}
                          </p>
                        )}
                      </div>
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        {item.onHandQty} / {item.minQty}
                      </Badge>
                    </div>
                  ))}
                </div>
                {lowStockItems.length > 5 && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                      <Link href="/app/inventory">
                        Ver los {lowStockItems.length} productos{" "}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/manager/expenses/new">
                  <TrendingDown className="w-3.5 h-3.5 mr-1.5" /> Gasto
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/payroll">
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Asistencias
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/inventory/requisitions/new">
                  <Package className="w-3.5 h-3.5 mr-1.5" /> Pedir insumos
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
                <Link href="/app/restaurant/menu">
                  <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" /> Menú
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Componentes auxiliares ─── */

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${color ?? ""}`}>{value}</p>
    </div>
  );
}

function AlertRow({
  tone,
  icon,
  text,
  href,
}: {
  tone: "orange" | "red" | "amber" | "blue";
  icon: React.ReactNode;
  text: string;
  href: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
  };
  return (
    <div className={`flex items-center gap-2 p-2.5 border rounded-lg text-xs ${toneClasses[tone]}`}>
      {icon}
      <span className="flex-1">{text}</span>
      <Link href={href} className="font-semibold hover:underline text-[11px] shrink-0">
        Ver →
      </Link>
    </div>
  );
}

function QuickModuleCard({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="border rounded-lg p-3 hover:bg-muted/30 hover:border-primary transition-colors text-center cursor-pointer h-full flex flex-col items-center justify-center gap-1.5">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
    </Link>
  );
}

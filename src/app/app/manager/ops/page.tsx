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
  Flower2, ShoppingBag, Bath, ShoppingCart, Calendar, FileText, BarChart3,
  Receipt, TrendingUp, Wallet, HelpCircle,
} from "lucide-react";

import { TodayShiftPanel } from "@/components/manager/TodayShiftPanel";
import { WithdrawalActions } from "@/components/manager/WithdrawalActions";
import { FoodServicePanel } from "@/components/manager/FoodServicePanel";
import {
  getShiftsForDay, getCandidateUsersForBusiness, isoDate, dateOnly,
} from "@/lib/schedule";
import { getFoodServicePax } from "@/lib/food-service";
import { resolveManagerScope } from "@/lib/manager-scope";
import { RequisitionTrackingPanel } from "@/components/manager/RequisitionTrackingPanel";
import { loadMyRequisitions } from "@/lib/manager-requisitions";

// Analytics
import { resolveAnalyticsFilters } from "@/lib/analytics-filters";
import {
  getKpisWithDelta, getSalesTimeSeries, getExpensesTimeSeries,
  getSalesByMethod, getAnalyticsByBusiness,
} from "@/lib/analytics";
import { suggestGranularity } from "@/lib/date-presets";
import { AnalyticsToolbar } from "@/components/analytics/AnalyticsToolbar";
import { KpiCard } from "@/components/analytics/KpiCard";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { DistributionDonut } from "@/components/analytics/DistributionDonut";
import { UpcomingEventsCard } from "@/components/events/UpcomingEventsCard";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtNumber = (n: number) => new Intl.NumberFormat("es-MX").format(n);

export default async function ManagerOpsDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const scope = await resolveManagerScope("ops");
  const firstName = scope.userName.split(" ")[0];

  if (scope.businesses.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>Sin negocios asignados</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne al menos un negocio.
          </CardContent>
        </Card>
        <UpcomingEventsCard />
      </div>
    );
  }

  const sp = await searchParams;
  const filters = resolveAnalyticsFilters(sp, scope.businessIds);

  const businessIds = scope.businessIds;
  const businesses = scope.businesses;
  const todayIso = isoDate();
  const today = dateOnly(todayIso);
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  const tomorrowLocal = new Date(todayLocal.getTime() + 24 * 3600 * 1000);
  const whereByBiz = { businessId: { in: businessIds } };

  const businessesMap = new Map(businesses.map((b) => [b.id, b.name]));

  const granularity = suggestGranularity(filters.range);

  const [
    kpis, salesSeries, expensesSeries, salesByMethod, byBusiness,
    pendingTasks, pendingPettyWithdrawals, pendingLargeWithdrawals,
    activeOrdersCount, totalTables, occupiedTablesRaw,
    occupiedRooms, totalRooms, roomsDirty, roomsMaintenance,
    todayCheckIns, todayCheckOuts, pendingRequisitions,
    staffOnShift, cashpoints, invItems,
    myRequisitions,
  ] = await Promise.all([
    getKpisWithDelta(filters.selectedBusinessIds, filters.range, filters.comparisonRange),
    getSalesTimeSeries(filters.selectedBusinessIds, filters.range, granularity),
    getExpensesTimeSeries(filters.selectedBusinessIds, filters.range, granularity),
    getSalesByMethod(filters.selectedBusinessIds, filters.range),
    businessIds.length > 1
      ? getAnalyticsByBusiness(filters.selectedBusinessIds, businessesMap, filters.range)
      : Promise.resolve([]),

    prisma.task.count({ where: { ...whereByBiz, status: { in: ["TODO", "DOING", "BLOCKED"] } } }),
    prisma.withdrawal.count({ where: { ...whereByBiz, status: "APPROVED", createdAt: { gte: todayLocal } } }),
    prisma.withdrawal.count({ where: { ...whereByBiz, status: "REQUESTED" } }),
    prisma.restaurantOrder.count({ where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } } }),
    prisma.restaurantTable.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.restaurantOrder.findMany({ where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } }, select: { tableId: true }, distinct: ["tableId"] }),
    prisma.hotelReservation.count({ where: { ...whereByBiz, status: "CHECKED_IN" } }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true, status: "DIRTY" } }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true, status: { in: ["MAINTENANCE", "OUT_OF_SERVICE"] } } }),
    prisma.hotelReservation.count({ where: { ...whereByBiz, status: { in: ["CONFIRMED", "PENDING"] }, checkIn: { gte: todayLocal, lt: tomorrowLocal } } }),
    prisma.hotelReservation.count({ where: { ...whereByBiz, status: "CHECKED_IN", checkOut: { gte: todayLocal, lt: tomorrowLocal } } }),
    prisma.requisition.count({ where: { ...whereByBiz, status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"] } } }),
    prisma.workDay.count({ where: { date: today, status: { in: ["OPEN", "NEEDS_REVIEW"] }, user: { businessId: { in: businessIds } } } }),
    prisma.cashpoint.findMany({ where: { businessId: { in: businessIds } }, select: { id: true, name: true, businessId: true }, orderBy: [{ businessId: "asc" }, { name: "asc" }] }),
    prisma.inventoryItem.findMany({ where: { ...whereByBiz, isActive: true }, select: { id: true, name: true, onHandQty: true, minQty: true, businessId: true } }),
    loadMyRequisitions(scope.userId, 15),
  ]);

  const occupiedTables = occupiedTablesRaw.length;
  const hasRestaurant = totalTables > 0;
  const hasHotel = totalRooms > 0;
  const lowStockItems = invItems.filter((i) => i.onHandQty <= i.minQty);

  const mergedSalesSeries = mergeSeriesForChart(salesSeries, filters.comparisonRange ? await getSalesTimeSeries(filters.selectedBusinessIds, filters.comparisonRange, granularity) : []);
  const mergedExpensesSeries = mergeSeriesForChart(expensesSeries, filters.comparisonRange ? await getExpensesTimeSeries(filters.selectedBusinessIds, filters.comparisonRange, granularity) : []);

  const hotelBusinessIds = businesses.map((b) => b.linkedHotelBusinessId).filter(Boolean) as string[];
  const foodServiceDays = hotelBusinessIds.length > 0
    ? await getFoodServicePax(hotelBusinessIds[0], 7)
    : [];

  const shiftsByBusiness = await Promise.all(
    businesses.map(async (b) => ({
      business: b,
      shifts: await getShiftsForDay(b.id, todayIso),
      candidates: await getCandidateUsersForBusiness(b.id),
    }))
  );

  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "Negocio";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panel de gerencia · {todayLocal.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {businesses.map((b) => (
              <Badge key={b.id} variant="secondary" className="text-xs">
                <Building2 className="w-3 h-3 mr-1" /> {b.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/manager/ops/help"><HelpCircle className="w-4 h-4 mr-1.5" /> Ayuda</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/manager/ops/finances${searchParamsToQs(sp)}`}>
              <DollarSign className="w-4 h-4 mr-1.5" /> Finanzas
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ops/reports"><FileText className="w-4 h-4 mr-1.5" /> Reportes</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Link href="/app/manager/ops/products-report"><Package className="w-4 h-4 mr-1.5" /> Productos</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/manager/ops/schedule"><Calendar className="w-4 h-4 mr-1.5" /> Turnos</Link>
          </Button>
        </div>
      </div>

      <UpcomingEventsCard />

      <AnalyticsToolbar
        preset={filters.preset}
        customFromIso={filters.customFromIso}
        customToIso={filters.customToIso}
        comparisonMode={filters.comparisonMode}
        range={filters.range}
        comparisonRange={filters.comparisonRange}
        allBusinesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
        selectedBusinessIdsFromUrl={filters.selectedBusinessIdsFromUrl}
        showBusinessSelector={businesses.length > 1}
      />

      {/* KPIs CON TOOLTIPS */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas"
          value={fmt(kpis.salesTotal)}
          delta={kpis.salesDelta}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          color="green"
          subtitle={`${fmtNumber(kpis.salesCount)} tx`}
          helpText="Total ingresado al negocio en el período seleccionado. Suma de todos los tickets cobrados (efectivo, tarjeta y transferencia)."
          helpSlug="ventas-totales"
        />
        <KpiCard
          label="Gastos"
          value={fmt(kpis.expensesTotal)}
          delta={kpis.expensesDelta}
          invertDelta={true}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          color="red"
          helpText="Todo lo que salió del negocio como gasto operativo: nóminas, insumos, propinas pagadas. NO incluye retiros de caja."
          helpSlug="gastos-totales"
        />
        <KpiCard
          label="Neto"
          value={fmt(kpis.netTotal)}
          delta={kpis.netDelta}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          color={kpis.netTotal >= 0 ? "blue" : "red"}
          subtitle="Ventas − Gastos"
          helpText="Utilidad operativa: ventas menos gastos. Si es verde, ganaste. Si es rojo, perdiste."
          helpSlug="utilidad-neta"
        />
        <KpiCard
          label="Ticket promedio"
          value={fmt(kpis.avgTicket)}
          delta={kpis.avgTicketDelta}
          icon={<Receipt className="h-4 w-4 text-purple-600" />}
          color="purple"
          helpText="Cuánto gasta en promedio cada cliente por visita. Ventas totales ÷ número de tickets."
          helpSlug="ticket-promedio"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title={`Ventas (${filters.range.label})`}
            data={mergedSalesSeries.actual}
            comparisonData={filters.comparisonRange ? mergedSalesSeries.comparison : undefined}
            type="area"
            color="#10b981"
          />
        </div>
        <DistributionDonut
          title="Métodos de pago"
          items={salesByMethod}
          height={200}
        />
      </div>

      {byBusiness.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Por negocio
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {filters.range.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {byBusiness.map((b) => (
                <div key={b.businessId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.businessName}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtNumber(b.salesCount)} tx · gastos {fmt(b.expensesTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmt(b.salesTotal)}</p>
                    <p className={`text-xs ${b.netTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                      Neto {fmt(b.netTotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" /> Operación del día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasHotel && (
                <OpBlock icon={<BedDouble className="w-4 h-4 text-purple-500" />} title="Hotel"
                  cta={<Button variant="ghost" size="sm" asChild><Link href="/app/hotel/frontdesk">Front Desk <ArrowRight className="w-3 h-3 ml-1" /></Link></Button>}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <Stat label="Llegadas hoy" value={todayCheckIns} />
                    <Stat label="Salidas hoy" value={todayCheckOuts} />
                    <Stat label="Por limpiar" value={roomsDirty} color={roomsDirty > 0 ? "text-amber-600" : undefined} />
                    <Stat label="Mantenimiento" value={roomsMaintenance} color={roomsMaintenance > 0 ? "text-red-600" : undefined} />
                  </div>
                </OpBlock>
              )}
              {hasRestaurant && (
                <OpBlock icon={<UtensilsCrossed className="w-4 h-4 text-orange-500" />} title="Restaurante"
                  cta={<div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/kds">KDS</Link></Button>
                    <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/tables">Mesas</Link></Button>
                    <Button variant="ghost" size="sm" asChild><Link href="/app/restaurant/pos">POS <ArrowRight className="w-3 h-3 ml-1" /></Link></Button>
                  </div>}>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Stat label="Mesas ocupadas" value={`${occupiedTables} / ${totalTables}`} />
                    <Stat label="Órdenes abiertas" value={activeOrdersCount} />
                    <Stat label="Ocupación" value={`${totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0}%`} />
                  </div>
                </OpBlock>
              )}
              {invItems.length > 0 && (
                <OpBlock icon={<Package className="w-4 h-4 text-blue-500" />} title="Inventario"
                  cta={<div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/app/manager/ops/requisitions">
                        Requisiciones {pendingRequisitions > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{pendingRequisitions}</Badge>}
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild><Link href="/app/manager/ops/inventory">Stock <ArrowRight className="w-3 h-3 ml-1" /></Link></Button>
                  </div>}>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Stat label="Productos activos" value={invItems.length} />
                    <Stat label="Bajo mínimo" value={lowStockItems.length} color={lowStockItems.length > 0 ? "text-red-600" : "text-green-600"} />
                    <Stat label="Requisiciones" value={pendingRequisitions} color={pendingRequisitions > 0 ? "text-amber-600" : undefined} />
                  </div>
                </OpBlock>
              )}

              <div className="grid grid-cols-3 gap-2">
                <ModuleLink icon={<ShoppingBag className="w-4 h-4 text-purple-500" />} label="Tienda" href="/app/store" />
                <ModuleLink icon={<Flower2 className="w-4 h-4 text-pink-500" />} label="Spa" href="/app/spa" />
                <ModuleLink icon={<Bath className="w-4 h-4 text-sky-500" />} label="Baños" href="/app/facilities/bathrooms" />
              </div>
            </CardContent>
          </Card>

          {foodServiceDays.length > 0 && (
            <FoodServicePanel hotelName={businesses[0]?.name ?? "Hotel"} days={foodServiceDays} />
          )}

          {mergedExpensesSeries.actual.length > 0 && (
            <TimeSeriesChart
              title="Gastos en el período"
              data={mergedExpensesSeries.actual}
              comparisonData={filters.comparisonRange ? mergedExpensesSeries.comparison : undefined}
              type="line"
              color="#ef4444"
              height={220}
            />
          )}

          {shiftsByBusiness.map(({ business, shifts, candidates }) => (
            <TodayShiftPanel
              key={business.id}
              businessId={business.id}
              businessName={business.name}
              dateIso={todayIso}
              shifts={shifts}
              candidates={candidates.map((c) => ({ id: c.id, fullName: c.fullName, username: c.username, jobTitle: c.jobTitle, role: c.role as string }))}
            />
          ))}
        </div>

        <div className="space-y-4">
          <WithdrawalActions businesses={businesses.map((b) => ({ id: b.id, name: b.name }))} cashpoints={cashpoints} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingLargeWithdrawals > 0 && <AlertRow tone="orange" text={`${pendingLargeWithdrawals} retiro(s) pendientes de aprobación`} href="/app/manager/ops/finances" />}
              {lowStockItems.length > 0 && <AlertRow tone="red" text={`${lowStockItems.length} producto(s) bajo mínimo`} href="/app/manager/ops/inventory" />}
              {roomsDirty > 0 && <AlertRow tone="amber" text={`${roomsDirty} habitación(es) por limpiar`} href="/app/hotel/housekeeping" />}
              {pendingTasks > 0 && <AlertRow tone="blue" text={`${pendingTasks} tarea(s) pendientes`} href="/app/ops/kanban/activities" />}
              {pendingLargeWithdrawals === 0 && lowStockItems.length === 0 && roomsDirty === 0 && pendingTasks === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Todo en orden ✓</p>
              )}
            </CardContent>
          </Card>

          <RequisitionTrackingPanel
            requisitions={myRequisitions}
            primaryBusinessId={businesses[0]?.id ?? ""}
            managerBasePath="/app/manager/ops"
          />

          {lowStockItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-red-500" /> Stock crítico</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate text-xs">{item.name}</p>
                        {businessIds.length > 1 && <p className="text-[10px] text-muted-foreground truncate">{bizName(item.businessId)}</p>}
                      </div>
                      <Badge variant="destructive" className="text-[10px] shrink-0">{item.onHandQty} / {item.minQty}</Badge>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <Link href={`/app/manager/ops/requisitions/new?businessId=${businesses[0].id}`}>
                      <Package className="w-3 h-3 mr-1" /> Pedir ahora
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Accesos rápidos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <QuickBtn icon={<DollarSign className="w-3.5 h-3.5 mr-1.5" />} label="Finanzas" href="/app/manager/ops/finances" />
              <QuickBtn icon={<Users className="w-3.5 h-3.5 mr-1.5" />} label="Equipo" href="/app/manager/ops/payroll" />
              <QuickBtn icon={<Package className="w-3.5 h-3.5 mr-1.5" />} label="Inventario" href="/app/manager/ops/inventory" />
              <QuickBtn icon={<ClipboardList className="w-3.5 h-3.5 mr-1.5" />} label="Requisiciones" href="/app/manager/ops/requisitions" />
              <QuickBtn icon={<FileText className="w-3.5 h-3.5 mr-1.5" />} label="Reportes" href="/app/manager/ops/reports" />
              <QuickBtn icon={<Package className="w-3.5 h-3.5 mr-1.5" />} label="Productos" href="/app/manager/ops/products-report" />
              <QuickBtn icon={<HelpCircle className="w-3.5 h-3.5 mr-1.5" />} label="Ayuda" href="/app/manager/ops/help" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function mergeSeriesForChart(
  actual: Array<{ label: string; value: number; count?: number; date: string }>,
  comparison: Array<{ label: string; value: number; count?: number; date: string }>
) {
  return {
    actual: actual.map((p) => ({ label: p.label, value: p.value, count: p.count })),
    comparison: actual.map((_, i) => ({
      label: comparison[i]?.label ?? "",
      value: comparison[i]?.value ?? 0,
      count: comparison[i]?.count,
    })),
  };
}

function searchParamsToQs(sp: Record<string, string | undefined>): string {
  const entries = Object.entries(sp).filter(([_, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (<div><p className="text-xs text-muted-foreground">{label}</p><p className={`font-semibold ${color ?? ""}`}>{value}</p></div>);
}

function OpBlock({ icon, title, cta, children }: { icon: React.ReactNode; title: string; cta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">{icon}<h3 className="text-sm font-semibold">{title}</h3></div>
        {cta}
      </div>
      {children}
    </div>
  );
}

function ModuleLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href}>
      <div className="border rounded-lg p-3 hover:bg-muted/30 hover:border-primary transition-colors text-center cursor-pointer h-full flex flex-col items-center justify-center gap-1.5">
        {icon}<p className="text-xs font-medium">{label}</p>
      </div>
    </Link>
  );
}

function QuickBtn({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Button variant="outline" size="sm" className="h-10 text-xs" asChild>
      <Link href={href}>{icon}{label}</Link>
    </Button>
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

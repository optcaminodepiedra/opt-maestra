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
  Store,
  Building2,
  ClipboardList,
  Package,
  ShoppingBag,
  Boxes,
} from "lucide-react";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(cents / 100);

/**
 * Resuelve los IDs de negocio que el MANAGER_OPS actual puede gestionar.
 * - Prioridad 1: UserBusinessAccess (si existe en BD — caso Claudia multi-negocio).
 * - Fallback: primaryBusinessId.
 * - Si no hay nada, devuelve [] (el dashboard mostrará estado vacío).
 */
async function getManagedBusinessIds(userId: string, primaryBusinessId: string | null): Promise<string[]> {
  // Intento leer UserBusinessAccess con raw query para no romper si la tabla no existe aún
  try {
    const rows = await prisma.$queryRaw<{ businessId: string }[]>`
      SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
    `;
    if (rows.length > 0) {
      const ids = rows.map((r) => r.businessId);
      // Si el primary no está incluido, lo agregamos para no perder acceso
      if (primaryBusinessId && !ids.includes(primaryBusinessId)) ids.push(primaryBusinessId);
      return ids;
    }
  } catch {
    // Tabla no existe aún → fallback al primary
  }
  return primaryBusinessId ? [primaryBusinessId] : [];
}

export default async function ManagerOpsDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; name?: string; role?: string; primaryBusinessId?: string | null };
  const firstName = u.name?.split(" ")[0] ?? "Gerente";

  // ── Determinar negocios gestionados ─────────────────────────────
  const businessIds = await getManagedBusinessIds(u.id ?? "", u.primaryBusinessId ?? null);
  const whereByBiz = businessIds.length > 0 ? { businessId: { in: businessIds } } : { businessId: "__none__" };

  // ── Fechas ──────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // ── Datos de negocios (nombres para headings) ──────────────────
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // ── KPIs consolidados ───────────────────────────────────────────
  const [salesTodayAgg, salesMonthAgg, expTodayAgg, pendingTasks, pendingWithdrawals] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...whereByBiz, createdAt: { gte: today } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...whereByBiz, createdAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { ...whereByBiz, createdAt: { gte: today } },
      _sum: { amountCents: true },
    }),
    prisma.task.count({
      where: { ...whereByBiz, status: { in: ["TODO", "DOING", "BLOCKED"] } },
    }),
    prisma.withdrawal.count({
      where: { ...whereByBiz, status: "REQUESTED" },
    }),
  ]);

  const salesToday = salesTodayAgg._sum.amountCents ?? 0;
  const salesMonth = salesMonthAgg._sum.amountCents ?? 0;
  const expensesToday = expTodayAgg._sum.amountCents ?? 0;

  // ── Personal en turno de los negocios gestionados ──────────────
  const staffOnShift = await prisma.workDay.count({
    where: {
      date: { gte: today },
      status: { in: ["OPEN", "NEEDS_REVIEW"] },
      user: businessIds.length > 0 ? { businessId: { in: businessIds } } : { businessId: "__none__" },
    },
  });

  // ── Hotel (solo si alguno de los negocios gestiona habitaciones) ─
  const [occupiedRooms, totalRooms, roomsDirty, roomsMaintenance, todayCheckIns, todayCheckOuts] = await Promise.all([
    prisma.hotelReservation.count({ where: { ...whereByBiz, status: "CHECKED_IN" } }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.hotelRoom.count({ where: { ...whereByBiz, isActive: true, status: "DIRTY" } }),
    prisma.hotelRoom.count({
      where: { ...whereByBiz, isActive: true, status: { in: ["MAINTENANCE", "OUT_OF_SERVICE"] } },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz,
        status: { in: ["CONFIRMED", "PENDING"] },
        checkIn: { gte: today, lt: new Date(today.getTime() + 24 * 3600 * 1000) },
      },
    }),
    prisma.hotelReservation.count({
      where: {
        ...whereByBiz,
        status: "CHECKED_IN",
        checkOut: { gte: today, lt: new Date(today.getTime() + 24 * 3600 * 1000) },
      },
    }),
  ]);
  const hasHotel = totalRooms > 0;

  // ── Restaurante (solo si hay mesas) ─────────────────────────────
  const [activeOrdersCount, totalTables, occupiedTablesRaw] = await Promise.all([
    prisma.restaurantOrder.count({ where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } } }),
    prisma.restaurantTable.count({ where: { ...whereByBiz, isActive: true } }),
    prisma.restaurantOrder.findMany({
      where: { ...whereByBiz, status: { in: ["OPEN", "SENT"] } },
      select: { tableId: true },
      distinct: ["tableId"],
    }),
  ]);
  const occupiedTables = occupiedTablesRaw.length;
  const hasRestaurant = totalTables > 0;

  // ── Inventario (stock bajo) ─────────────────────────────────────
  const invItems = await prisma.inventoryItem.findMany({
    where: { ...whereByBiz, isActive: true },
    select: { id: true, name: true, onHandQty: true, minQty: true, businessId: true },
  });
  const lowStockItems = invItems.filter((i) => i.onHandQty <= i.minQty);

  // ── Desglose por negocio (ventas hoy por negocio) ──────────────
  const salesByBusiness =
    businessIds.length > 1
      ? await prisma.sale.groupBy({
          by: ["businessId"],
          where: { ...whereByBiz, createdAt: { gte: today } },
          _sum: { amountCents: true },
          _count: true,
        })
      : [];

  const bizName = (id: string) => businesses.find((b) => b.id === id)?.name ?? "Negocio";

  // ── Sin negocios asignados: estado vacío ────────────────────────
  if (businessIds.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin negocios asignados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu usuario no tiene un negocio principal configurado ni accesos múltiples. Pide a un administrador
            que te asigne al menos un negocio para poder ver tu panel de operación.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ═══════════════════════════ Header ═══════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Panel de gerencia operativa ·{" "}
            {today.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
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
            <Link href="/app/ops/kanban/activities">
              <CheckSquare className="w-4 h-4 mr-1.5" /> Tareas
            </Link>
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════ KPIs ═══════════════════════════ */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas hoy</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(salesToday)}</div>
            <p className="text-xs text-muted-foreground">
              {salesTodayAgg._count} transacciones · {fmt(salesMonth)} en el mes
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
                {todayCheckIns} llegadas · {todayCheckOuts} salidas hoy
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
              <p className="text-xs text-muted-foreground">{activeOrdersCount} órdenes abiertas</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-purple-500 py-0">
            <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Productos activos</CardTitle>
              <Boxes className="h-3.5 w-3.5 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-bold">{invItems.length}</div>
              <p className="text-xs text-muted-foreground">En catálogo de inventario</p>
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
            <p className="text-xs text-muted-foreground">Egresos registrados hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════ Desglose por negocio (si hay >1) ═══════════════════════════ */}
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
                  <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
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

      {/* ═══════════════════════════ Operación del día ═══════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Panel de operación */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Operación del día
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Hotel */}
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
                  <div>
                    <p className="text-xs text-muted-foreground">Llegadas hoy</p>
                    <p className="font-semibold">{todayCheckIns}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Salidas hoy</p>
                    <p className="font-semibold">{todayCheckOuts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Por limpiar</p>
                    <p className={`font-semibold ${roomsDirty > 0 ? "text-amber-600" : ""}`}>{roomsDirty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mantenimiento</p>
                    <p className={`font-semibold ${roomsMaintenance > 0 ? "text-red-600" : ""}`}>
                      {roomsMaintenance}
                    </p>
                  </div>
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
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/app/restaurant/tables">
                      Ver mesas <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Mesas ocupadas</p>
                    <p className="font-semibold">
                      {occupiedTables} / {totalTables}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Órdenes abiertas</p>
                    <p className="font-semibold">{activeOrdersCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ocupación</p>
                    <p className="font-semibold">
                      {totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Inventario (si gestiona tienda o almacén) */}
            {invItems.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold">Inventario</h3>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/app/inventory">
                      Ver stock <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Productos activos</p>
                    <p className="font-semibold">{invItems.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bajo mínimo</p>
                    <p className={`font-semibold ${lowStockItems.length > 0 ? "text-red-600" : "text-green-600"}`}>
                      {lowStockItems.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="font-semibold">
                      {lowStockItems.length === 0 ? "Óptimo" : "Requiere compras"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sin operaciones */}
            {!hasHotel && !hasRestaurant && invItems.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground border rounded-lg border-dashed">
                No hay operaciones activas para los negocios que gestionas.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════ Panel lateral ═══════════════════════════ */}
        <div className="space-y-4">
          {/* Alertas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pendingWithdrawals > 0 && (
                <AlertRow
                  tone="orange"
                  icon={<AlertTriangle className="w-4 h-4 shrink-0 text-orange-500" />}
                  text={`${pendingWithdrawals} retiro(s) pendientes`}
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
              {pendingWithdrawals === 0 &&
                lowStockItems.length === 0 &&
                roomsDirty === 0 &&
                pendingTasks === 0 && (
                  <div className="text-center py-3">
                    <p className="text-xs text-muted-foreground">Todo en orden ✓</p>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Productos críticos (top 5) */}
          {lowStockItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-red-500" /> Stock crítico
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
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
                        Ver los {lowStockItems.length} productos <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Accesos rápidos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {buildQuickAccess({ hasHotel, hasRestaurant, hasInventory: invItems.length > 0 }).map((item) => (
                <Button key={item.href} variant="outline" size="sm" className="h-10 text-xs" asChild>
                  <Link href={item.href}>
                    <item.icon className="w-3.5 h-3.5 mr-1.5" /> {item.label}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Componentes auxiliares ───────────────────────── */

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

function buildQuickAccess(opts: { hasHotel: boolean; hasRestaurant: boolean; hasInventory: boolean }) {
  const items: { label: string; href: string; icon: typeof BedDouble }[] = [];
  if (opts.hasHotel) {
    items.push({ label: "Reservaciones", href: "/app/hotel/reservations", icon: BedDouble });
    items.push({ label: "Housekeeping", href: "/app/hotel/housekeeping", icon: Sparkles });
  }
  if (opts.hasRestaurant) {
    items.push({ label: "Mesas", href: "/app/restaurant/tables", icon: UtensilsCrossed });
    items.push({ label: "KDS", href: "/app/restaurant/kds", icon: UtensilsCrossed });
  }
  if (opts.hasInventory) {
    items.push({ label: "Inventario", href: "/app/inventory", icon: Boxes });
    items.push({ label: "Requisiciones", href: "/app/inventory/requisitions", icon: ClipboardList });
  }
  items.push({ label: "Asistencias", href: "/app/payroll", icon: Users });
  items.push({ label: "Gastos", href: "/app/owner/expenses", icon: Store });
  return items.slice(0, 8);
}

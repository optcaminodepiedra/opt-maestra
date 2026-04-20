import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckSquare, Clock, CalendarDays,
  UtensilsCrossed, BedDouble, Sparkles,
  ArrowRight, Fingerprint
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Íconos por rol para personalizar el dashboard
const ROLE_CONFIG: Record<string, { label: string; color: string; quickLinks: { label: string; href: string }[] }> = {
  STAFF_WAITER: {
    label: "Mesero/a",
    color: "blue",
    quickLinks: [
      { label: "Ver mesas", href: "/app/restaurant/tables" },
      { label: "Mis órdenes", href: "/app/restaurant/pos" },
      { label: "Menú", href: "/app/restaurant/menu" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
    ],
  },
  STAFF_KITCHEN: {
    label: "Cocina",
    color: "orange",
    quickLinks: [
      { label: "KDS Cocina", href: "/app/restaurant/kds" },
      { label: "Ver menú", href: "/app/restaurant/menu" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Inventario", href: "/app/inventory" },
    ],
  },
  STAFF_BAR: {
    label: "Barra / Bar",
    color: "purple",
    quickLinks: [
      { label: "POS Bar", href: "/app/restaurant/pos" },
      { label: "KDS", href: "/app/restaurant/kds" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Ver mesas", href: "/app/restaurant/tables" },
    ],
  },
  STAFF_RECEPTION: {
    label: "Recepcionista",
    color: "teal",
    quickLinks: [
      { label: "Reservaciones", href: "/app/hotel/reservations" },
      { label: "Front Desk", href: "/app/hotel/frontdesk" },
      { label: "Habitaciones", href: "/app/hotel/rooms" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
    ],
  },
  STAFF_EXPERIENCES: {
    label: "Experiencias",
    color: "green",
    quickLinks: [
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Reservaciones", href: "/app/hotel/reservations" },
      { label: "POS", href: "/app/restaurant/pos" },
      { label: "Asistencias", href: "/app/payroll" },
    ],
  },
  STAFF_HOUSEKEEPING: {
    label: "Housekeeping",
    color: "pink",
    quickLinks: [
      { label: "Habitaciones", href: "/app/hotel/rooms" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
      { label: "Housekeeping", href: "/app/hotel/housekeeping" },
    ],
  },
  STAFF_CASHIER: {
    label: "Cajero/a",
    color: "green",
    quickLinks: [
      { label: "Abrir POS", href: "/app/restaurant/pos" },
      { label: "Turnos de caja", href: "/app/cashpoint" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
    ],
  },
  STAFF_MAINTENANCE: {
    label: "Mantenimiento",
    color: "gray",
    quickLinks: [
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
      { label: "Inventario", href: "/app/inventory" },
      { label: "Tickets", href: "/app/ops/kanban/tickets" },
    ],
  },
  STAFF_FIELD: {
    label: "Campo / Rancho",
    color: "green",
    quickLinks: [
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
      { label: "Tickets", href: "/app/ops/kanban/tickets" },
      { label: "Inventario", href: "/app/inventory" },
    ],
  },
  STAFF_STORE: {
    label: "Tiendita",
    color: "amber",
    quickLinks: [
      { label: "POS Tienda", href: "/app/store" },
      { label: "Inventario", href: "/app/inventory" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
    ],
  },
  SALES: {
    label: "Ventas",
    color: "blue",
    quickLinks: [
      { label: "Reservaciones", href: "/app/hotel/reservations" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Reportes", href: "/app/reports" },
      { label: "Hotel", href: "/app/hotel" },
    ],
  },
  RESERVATIONS: {
    label: "Reservaciones",
    color: "teal",
    quickLinks: [
      { label: "Reservaciones", href: "/app/hotel/reservations" },
      { label: "Front Desk", href: "/app/hotel/frontdesk" },
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Hotel", href: "/app/hotel" },
    ],
  },
  STAFF_MAINTENANCE_DEFAULT: {
    label: "Operaciones",
    color: "gray",
    quickLinks: [
      { label: "Mis tareas", href: "/app/ops/kanban/activities" },
      { label: "Asistencias", href: "/app/payroll" },
      { label: "Checador", href: "/app/reloj" },
      { label: "Tickets", href: "/app/ops/kanban/tickets" },
    ],
  },
};

export default async function OpsStaffDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const role = user.role as string;
  const userId = user.id as string;
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG["STAFF_MAINTENANCE_DEFAULT"];

  // Fechas
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Mis tareas asignadas pendientes
  const myTasks = await prisma.task.findMany({
    where: {
      assignedId: userId,
      status: { in: ["TODO", "DOING", "BLOCKED"] },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    take: 5,
    select: {
      id: true, title: true, status: true, priority: true,
      dueDate: true, area: true, type: true,
    },
  });

  // Mi turno de hoy
  const myWorkDay = await prisma.workDay.findFirst({
    where: { userId, date: { gte: today }, status: "OPEN" },
    include: {
      punches: { orderBy: { timestamp: "asc" }, take: 10 },
    },
  });

  const lastPunch = myWorkDay?.punches?.at(-1);

  // Calcular horas trabajadas del día
  const minutesWorked = myWorkDay?.totalMinutes ?? 0;
  const hoursWorked = Math.floor(minutesWorked / 60);
  const minsWorked = minutesWorked % 60;

  const PRIORITY_COLORS: Record<string, string> = {
    URGENT: "text-red-600 bg-red-50 border-red-200",
    HIGH: "text-orange-600 bg-orange-50 border-orange-200",
    MEDIUM: "text-blue-600 bg-blue-50 border-blue-200",
    LOW: "text-gray-600 bg-gray-50 border-gray-200",
  };

  const STATUS_LABELS: Record<string, string> = {
    TODO: "Por hacer",
    DOING: "En progreso",
    BLOCKED: "Bloqueada",
  };

  const PUNCH_LABELS: Record<string, string> = {
    ENTRADA: "Entrada",
    SALIDA: "Salida",
    INICIO_COMIDA: "Salida a comer",
    FIN_COMIDA: "Regreso de comida",
    INICIO_COMPRAS: "Salida a compras",
    FIN_COMPRAS: "Regreso de compras",
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header personalizado por rol */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Hola, {user.name?.split(" ")[0]} 👋</h1>
            <Badge variant="secondary">{config.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/app/reloj">
            <Fingerprint className="w-4 h-4 mr-1.5" /> Checar entrada/salida
          </Link>
        </Button>
      </div>

      {/* Estado del turno */}
      <Card className={myWorkDay ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${myWorkDay ? "bg-green-100" : "bg-amber-100"}`}>
              <Clock className={`w-5 h-5 ${myWorkDay ? "text-green-600" : "text-amber-600"}`} />
            </div>
            <div>
              {myWorkDay ? (
                <>
                  <p className="font-medium text-sm text-green-800">Turno activo</p>
                  <p className="text-xs text-green-700">
                    {hoursWorked > 0 ? `${hoursWorked}h ` : ""}{minsWorked}min trabajados
                    {lastPunch && ` · Último registro: ${PUNCH_LABELS[lastPunch.type] ?? lastPunch.type} a las ${lastPunch.timestamp.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm text-amber-800">Sin turno activo hoy</p>
                  <p className="text-xs text-amber-700">Recuerda registrar tu entrada en el checador.</p>
                </>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/payroll">Ver mis asistencias <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Mis tareas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Mis tareas pendientes
                {myTasks.length > 0 && (
                  <Badge variant="secondary">{myTasks.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/ops/kanban/activities">
                  Ver todo <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myTasks.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Sin tareas asignadas. ¡Todo al corriente!
              </div>
            ) : (
              <div className="divide-y">
                {myTasks.map(task => (
                  <Link
                    key={task.id}
                    href="/app/ops/kanban/activities"
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className={`mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority === "URGENT" ? "⚡" : task.priority === "HIGH" ? "↑" : "·"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_LABELS[task.status]}
                        {task.dueDate && ` · Vence ${task.dueDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mis accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {config.quickLinks.map(link => (
                <Button key={link.href} variant="outline" size="sm" className="h-10 text-xs" asChild>
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Checador rápido */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <Fingerprint className="w-8 h-8 text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Reloj checador</p>
                <p className="text-xs text-muted-foreground">Registra tu entrada, comida y salida</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/app/reloj">Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
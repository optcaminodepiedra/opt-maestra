import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, TrendingUp, BedDouble, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function OwnerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userName = session.user.name || "Equipo";
  const role = (session.user as any).role as string;

  // 1. OBTENEMOS DATOS REALES DE LA BASE DE DATOS
  
  // Personal actualmente en turno (Reloj Checador)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const activeStaff = await prisma.workDay.count({
    where: { 
      date: { gte: today },
      status: "OPEN" 
    }
  });

// Tareas pendientes, en curso o bloqueadas (Kanban y Tickets)
  const pendingTasks = await prisma.task.count({
    where: {
      status: { in: ["TODO", "DOING", "BLOCKED"] }
    }
  });

  // (Aquí después conectaremos las ventas y el hotel reales)
  const dummySales = "$ 14,520.00";
  const dummyOccupancy = "8 / 12";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hola, {userName}</h1>
        <p className="text-muted-foreground mt-1">
          Este es el resumen operativo de Camino de Piedra para hoy.
        </p>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Tarjeta de Ventas */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ventas del Día (Est.)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dummySales}</div>
            <p className="text-xs text-muted-foreground mt-1">+12% vs ayer</p>
          </CardContent>
        </Card>

        {/* Tarjeta de Personal */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Personal en Turno</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStaff}</div>
            <p className="text-xs text-muted-foreground mt-1">Empleados activos ahora</p>
          </CardContent>
        </Card>

        {/* Tarjeta de Ocupación */}
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ocupación Hotel</CardTitle>
            <BedDouble className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dummyOccupancy}</div>
            <p className="text-xs text-muted-foreground mt-1">Habitaciones ocupadas</p>
          </CardContent>
        </Card>

        {/* Tarjeta de Tareas */}
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tareas Pendientes</CardTitle>
            <CheckSquare className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Requieren atención</p>
          </CardContent>
        </Card>

      </div>

      {/* SEGUNDA SECCIÓN: ACCESOS RÁPIDOS Y ALERTAS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Columna Izquierda: Accesos Rápidos (Ocupa 4 columnas) */}
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors" asChild>
              <Link href="/app/restaurant/tables">
                <span className="font-semibold">Ir al Mapa de Mesas</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors" asChild>
              <Link href="/app/hotel/calendar">
                <span className="font-semibold">Calendario de Hotel</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors" asChild>
              <Link href="/app/payroll">
                <span className="font-semibold">Revisar Asistencias</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors" asChild>
              <Link href="/app/ops/kanban/activities">
                <span className="font-semibold">Tablero de Tareas</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Columna Derecha: Alertas Operativas (Ocupa 3 columnas) */}
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Alertas Operativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeStaff === 0 ? (
              <div className="flex items-center gap-3 text-sm p-3 bg-muted/50 rounded-lg border">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Nadie ha hecho check-in aún.</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                <Users className="h-4 w-4 text-blue-600" />
                <span>Hay {activeStaff} empleado(s) trabajando ahora.</span>
                <Link href="/app/payroll" className="ml-auto flex items-center gap-1 text-blue-600 font-semibold hover:underline">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {pendingTasks > 0 && (
              <div className="flex items-center gap-3 text-sm p-3 bg-orange-50 text-orange-800 rounded-lg border border-orange-100">
                <CheckSquare className="h-4 w-4 text-orange-600" />
                <span>{pendingTasks} tareas pendientes en el tablero.</span>
                <Link href="/app/ops/kanban/activities" className="ml-auto flex items-center gap-1 text-orange-600 font-semibold hover:underline">
                  Ver <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
            
            {/* Espacio para alertas futuras de inventario bajo o mesas abiertas mucho tiempo */}
            <div className="flex items-center justify-center text-xs text-muted-foreground p-4 border border-dashed rounded-lg">
              Más alertas se conectarán pronto...
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
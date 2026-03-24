import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, LogOut, BedDouble, Sparkles, Clock } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HotelDashboardPage() {
  const session = await getServerSession(authOptions);
  
  // OBTENEMOS LAS FECHAS CLAVE (Hoy a las 00:00 y Hoy a las 23:59)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 1. Llegadas de hoy (Check-in esperado hoy y que sigan pendientes/confirmadas)
  const arrivalsTodayCount = await prisma.hotelReservation.count({
    where: {
      checkIn: { gte: todayStart, lte: todayEnd },
      status: { in: ["PENDING", "CONFIRMED"] }
    }
  });

  // 2. Salidas de hoy (Check-out esperado hoy y que sigan adentro)
  const departuresTodayCount = await prisma.hotelReservation.count({
    where: {
      checkOut: { gte: todayStart, lte: todayEnd },
      status: "CHECKED_IN"
    }
  });

  // 3. Cuartos ocupados (Para calcular ocupación)
  const totalRooms = await prisma.hotelRoom.count({ where: { isActive: true } });
  const occupiedRooms = await prisma.hotelRoom.count({ where: { status: "OCCUPIED", isActive: true } });
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // 4. Cuartos sucios
  const dirtyRooms = await prisma.hotelRoom.findMany({
    where: { status: "DIRTY", isActive: true },
    select: { name: true }
  });

  // 5. Lista detallada de llegadas
  const arrivalsList = await prisma.hotelReservation.findMany({
    where: {
      checkIn: { gte: todayStart, lte: todayEnd },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }
    },
    include: {
      guest: true,
      room: true
    },
    orderBy: { checkIn: "asc" }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recepción y Operación</h1>
          <p className="text-muted-foreground mt-1">
            Control de llegadas, salidas y limpieza para el día de hoy.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/hotel/reservations/new">+ Nueva Reserva</Link>
            </Button>
            <Button className="bg-primary hover:bg-primary/90" asChild>
            <Link href="/app/hotel/calendar">Ver Calendario Completo</Link>
            </Button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Llegadas Hoy</CardTitle>
            <Key className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{arrivalsTodayCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Huéspedes esperados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Salidas Hoy</CardTitle>
            <LogOut className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departuresTodayCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Dejan el hotel</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ocupación</CardTitle>
            <BedDouble className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyPercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">{occupiedRooms} de {totalRooms} cuartos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Limpieza Pendiente</CardTitle>
            <Sparkles className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dirtyRooms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Habitaciones sucias</p>
          </CardContent>
        </Card>
      </div>

      {/* DETALLES OPERATIVOS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* LISTA DE LLEGADAS */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Próximas Llegadas y Check-ins Activos</CardTitle>
          </CardHeader>
          <CardContent>
            {arrivalsList.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                    No hay llegadas programadas para hoy.
                </div>
            ) : (
                <div className="space-y-4">
                {arrivalsList.map((arrival) => (
                    <div key={arrival.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-muted/20 gap-3">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2 rounded-full shrink-0">
                        <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                        <p className="font-semibold">{arrival.guest.fullName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Badge variant="outline" className="bg-white">Hab. {arrival.room.name}</Badge>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3"/> 
                                {arrival.checkIn.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                        </div>
                    </div>
                    {arrival.status === "CHECKED_IN" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none shrink-0 self-start sm:self-auto">En Casa</Badge>
                    ) : (
                        // NOTA: Después conectaremos este botón a una acción para cambiar el status a CHECKED_IN
                        <Button size="sm" variant="secondary" className="shrink-0 self-start sm:self-auto">Hacer Check-in</Button>
                    )}
                    </div>
                ))}
                </div>
            )}
          </CardContent>
        </Card>

        {/* MÓDULO DE LIMPIEZA RÁPIDA */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Estatus de Limpieza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Las siguientes habitaciones están marcadas como sucias y requieren atención.
              </p>
              
              {dirtyRooms.length === 0 ? (
                  <div className="text-center p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 font-medium">
                      ¡Todo limpio! No hay habitaciones sucias pendientes.
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {dirtyRooms.map((room) => (
                    <div key={room.name} className="flex flex-col items-center justify-center p-3 border border-red-200 bg-red-50 text-red-700 rounded-lg">
                        <span className="font-bold text-lg">{room.name}</span>
                        <span className="text-[10px] uppercase font-semibold">Sucia</span>
                    </div>
                    ))}
                  </div>
              )}
              
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
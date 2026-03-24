import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, LogOut, BedDouble, Sparkles, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function HotelDashboardPage() {
  // DATOS SIMULADOS (Pronto los conectaremos a tu schema real)
  const stats = {
    arrivalsToday: 5,
    departuresToday: 3,
    occupancy: "65%",
    dirtyRooms: 4,
  };

  const arrivals = [
    { id: "1", guest: "Familia Martínez", room: "102", eta: "15:00", status: "PENDING" },
    { id: "2", guest: "Carlos Slim", room: "Suite 1", eta: "16:30", status: "PENDING" },
    { id: "3", guest: "Ana Sofía", room: "204", eta: "18:00", status: "CHECKED_IN" },
  ];

  const dirtyRoomsList = ["101", "105", "202", "208"];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ENCABEZADO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recepción y Operación</h1>
          <p className="text-muted-foreground mt-1">
            Control de llegadas, salidas y limpieza para el día de hoy.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" asChild>
          <Link href="/app/hotel/calendar">Ver Calendario Completo</Link>
        </Button>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Llegadas (Check-in)</CardTitle>
            <Key className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.arrivalsToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Huéspedes esperados hoy</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Salidas (Check-out)</CardTitle>
            <LogOut className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.departuresToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Dejan el hotel hoy</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Ocupación</CardTitle>
            <BedDouble className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupancy}</div>
            <p className="text-xs text-muted-foreground mt-1">Capacidad actual</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Limpieza Pendiente</CardTitle>
            <Sparkles className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dirtyRooms}</div>
            <p className="text-xs text-muted-foreground mt-1">Habitaciones sucias</p>
          </CardContent>
        </Card>
      </div>

      {/* DETALLES OPERATIVOS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* LISTA DE LLEGADAS */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Próximas Llegadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {arrivals.map((arrival) => (
                <div key={arrival.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{arrival.guest}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="bg-white">Hab. {arrival.room}</Badge>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> ETA: {arrival.eta}</span>
                      </div>
                    </div>
                  </div>
                  {arrival.status === "CHECKED_IN" ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">En Casa</Badge>
                  ) : (
                    <Button size="sm" variant="secondary">Hacer Check-in</Button>
                  )}
                </div>
              ))}
            </div>
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
                Las siguientes habitaciones requieren atención de las recamaristas antes del próximo Check-in.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {dirtyRoomsList.map((room) => (
                  <div key={room} className="flex flex-col items-center justify-center p-3 border border-red-200 bg-red-50 text-red-700 rounded-lg">
                    <span className="font-bold text-lg">{room}</span>
                    <span className="text-[10px] uppercase font-semibold">Sucia</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 text-primary border-primary/30">
                Ver reporte completo
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
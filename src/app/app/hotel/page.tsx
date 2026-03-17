import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function HotelHubPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hotel (PMS)</h1>
        <p className="text-sm text-muted-foreground">
          Reservas + Front Desk + Housekeeping + Mantenimiento + Reportes (multi-hotel).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ocupación, disponibles, limpieza, mantenimiento e ingresos.
            </p>
            <Button asChild className="w-full">
              <Link href="/app/hotel/dashboard">Abrir dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Habitaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tipos, habitaciones, estado (disponible/ocupada/limpieza/mantto).
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/hotel/rooms">Administrar habitaciones</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reservas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Crear, editar, cancelar, no-show, calendario y disponibilidad.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/hotel/reservations">Ver reservas</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Front Desk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Check-in/out, cambios de habitación, depósitos, cargos a cuenta.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/hotel/frontdesk">Abrir recepción</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Housekeeping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Limpieza, estados por habitación, pendientes y turnos.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/hotel/housekeeping">Abrir limpieza</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reportes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ocupación, ADR, RevPAR, ingresos, cancelaciones, no-shows.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/hotel/reports">Ver reportes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function RestaurantHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Restaurante</h1>
          <p className="text-sm text-muted-foreground">
            POS + Mesas + Menú + KDS (comanderas digitales)
          </p>
        </div>
        <Badge variant="secondary">Beta</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* POS */}
        <Card>
          <CardHeader>
            <CardTitle>POS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cobro rápido: mesa / para llevar / cliente. Envía a cocina (KDS).
            </p>
            <Button asChild className="w-full">
              <Link href="/app/restaurant/pos">Abrir POS</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Mesas */}
        <Card>
          <CardHeader>
            <CardTitle>Mesas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vista visual de mesas, estado (libre/ocupada/cerrando), consumo.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/restaurant/tables">Ver mesas</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Menú */}
        <Card>
          <CardHeader>
            <CardTitle>Menú</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Categorías, productos, modificadores (extras), costos e inventario.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/restaurant/menu">Administrar menú</Link>
            </Button>
          </CardContent>
        </Card>

        {/* KDS */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>KDS (Cocina)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tickets en vivo por estación: nuevo/en preparación/listo.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/restaurant/kds">Abrir KDS</Link>
            </Button>
          </CardContent>
        </Card>

        {/* ✅ Reportes */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Top productos, ventas por periodo, por caja/local, por categoría y más.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/app/restaurant/reports">Abrir Reportes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
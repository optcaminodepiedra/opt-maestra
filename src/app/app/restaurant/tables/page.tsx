import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  getTablesWithStatus,
  getMeserosForBusiness,
} from "@/lib/restaurant-tables.actions";
import { TablesClient } from "@/components/restaurant/TablesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
];

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para acceder a las mesas del restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;

  // Determinar qué negocio mostrar
  // Prioridad: query param > primaryBusinessId del usuario > primer restaurante con mesas
  let businessId = sp.businessId ?? me.primaryBusinessId ?? null;

  if (!businessId) {
    // Buscar el primer negocio con mesas
    const firstWithTables = await prisma.restaurantTable.findFirst({
      where: { isActive: true },
      select: { businessId: true },
      orderBy: { createdAt: "asc" },
    });
    businessId = firstWithTables?.businessId ?? null;
  }

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin restaurante configurado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>No hay un restaurante con mesas configuradas.</p>
            <p>Si eres administrador, configura las mesas en el panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });

  if (!business) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Negocio no encontrado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            El negocio especificado no existe.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cargar mesas con estado actual y meseros disponibles
  const [tablesData, meseros] = await Promise.all([
    getTablesWithStatus(businessId),
    getMeserosForBusiness(businessId),
  ]);

  // Si no hay mesas, mostrar mensaje
  if (tablesData.summary.total === 0) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-orange-500" />
            Mesas — {business.name}
          </h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p>Este restaurante no tiene mesas configuradas todavía.</p>
            <p className="text-xs">
              Pide a un administrador que ejecute el SQL de inicialización
              o configure las mesas desde el panel de configuración.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-orange-500" />
            Mesas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business.name} · {tablesData.summary.total} mesas
          </p>
        </div>
      </div>

      <TablesClient
        byArea={tablesData.byArea}
        areas={tablesData.areas}
        summary={tablesData.summary}
        meseros={meseros}
        businessId={businessId}
      />
    </div>
  );
}

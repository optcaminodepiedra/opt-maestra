import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { getRestaurantLayout } from "@/lib/restaurant-tables.actions";
import { TableEditor } from "@/components/restaurant/TableEditor";

export const dynamic = "force-dynamic";

const MANAGE_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT"];

export default async function ManageTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;

  if (!MANAGE_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores y gerentes pueden editar el mapa de mesas.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  let businessId = sp.businessId ?? me.primaryBusinessId ?? null;

  if (!businessId) {
    const first = await prisma.restaurantTable.findFirst({
      where: { isActive: true },
      select: { businessId: true },
    });
    businessId = first?.businessId ?? null;
  }

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No hay restaurantes configurados.
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) redirect("/app");

  const layout = await getRestaurantLayout(businessId);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/restaurant/tables?businessId=${businessId}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" />
          Editor de mapa de mesas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {business.name} · Arrastra mesas y áreas para reorganizar. Click para seleccionar.
        </p>
      </div>

      <TableEditor
        businessId={businessId}
        initialTables={layout.tables as any}
        initialAreas={layout.areas}
      />
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { getRestaurantLayout } from "@/lib/restaurant-tables.actions";
import {
  resolveRestaurantBusinessId,
  listRestaurantOptions,
} from "@/lib/restaurant-resolve";
import { TableEditor } from "@/components/restaurant/TableEditor";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";

export const dynamic = "force-dynamic";

const MANAGE_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH"];

export default async function ManageTablesPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;
  const userId = me.id ?? "";

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

  const businessId = await resolveRestaurantBusinessId({
    queryBusinessId: sp.businessId,
    userId,
    userRole: role,
    userPrimaryBusinessId: me.primaryBusinessId,
  });

  if (sp.businessId && !businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para editar este restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes acceso a ningún restaurante.
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

  const [layout, options] = await Promise.all([
    getRestaurantLayout(businessId),
    listRestaurantOptions(userId, role),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/restaurant/tables?businessId=${businessId}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-500" />
            Editor de mapa de mesas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business.name} · Arrastra mesas y áreas para reorganizar.
          </p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      <TableEditor
        businessId={businessId}
        initialTables={layout.tables as any}
        initialAreas={layout.areas}
      />
    </div>
  );
}

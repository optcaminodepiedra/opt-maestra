import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, ShieldAlert } from "lucide-react";
import {
  getRestaurantLayout,
  getMeserosForBusiness,
} from "@/lib/restaurant-tables.actions";
import {
  resolveRestaurantBusinessId,
  listRestaurantOptions,
} from "@/lib/restaurant-resolve";
import { TablesView } from "@/components/restaurant/TablesView";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
];
const MANAGE_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH"];

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;
  const userId = me.id ?? "";

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para acceder a las mesas.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;

  // Resolver el negocio respetando permisos
  const businessId = await resolveRestaurantBusinessId({
    queryBusinessId: sp.businessId,
    userId,
    userRole: role,
    userPrimaryBusinessId: me.primaryBusinessId,
  });

  // Si pidió un negocio específico y no tiene acceso → 403
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
            No tienes acceso al restaurante solicitado. Contacta a un administrador
            si necesitas permisos.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante asignado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>No tienes acceso a ningún restaurante con mesas configuradas.</p>
            <p>Contacta al administrador para que te asigne acceso.</p>
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
        </Card>
      </div>
    );
  }

  const [layout, meseros, options] = await Promise.all([
    getRestaurantLayout(businessId),
    getMeserosForBusiness(businessId),
    listRestaurantOptions(userId, role),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-orange-500" />
            Mesas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{business.name}</p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      <TablesView
        businessId={businessId}
        tables={layout.tables as any}
        areas={layout.areas}
        summary={layout.summary}
        meseros={meseros}
        canManage={MANAGE_ROLES.includes(role)}
      />
    </div>
  );
}

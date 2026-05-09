import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";
import {
  getRestaurantLayout,
  getMeserosForBusiness,
} from "@/lib/restaurant-tables.actions";
import { TablesView } from "@/components/restaurant/TablesView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
];
const MANAGE_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT"];

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
            No tienes permisos para acceder a las mesas.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;

  // Determinar negocio: query > primaryBusinessId > primer negocio con mesas
  let businessId = sp.businessId ?? null;

  if (!businessId) {
    // Si el usuario tiene un negocio asignado, intentar usarlo
    if (me.primaryBusinessId) {
      const has = await prisma.restaurantTable.findFirst({
        where: { businessId: me.primaryBusinessId, isActive: true },
      });
      if (has) businessId = me.primaryBusinessId;
    }
    // Si aún no, buscar primer negocio con mesas
    if (!businessId) {
      const first = await prisma.restaurantTable.findFirst({
        where: { isActive: true },
        select: { businessId: true },
        orderBy: { createdAt: "asc" },
      });
      businessId = first?.businessId ?? null;
    }
  }

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin restaurante configurado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No hay restaurantes con mesas. Pide a un administrador que configure las mesas.
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

  const [layout, meseros] = await Promise.all([
    getRestaurantLayout(businessId),
    getMeserosForBusiness(businessId),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <UtensilsCrossed className="w-7 h-7 text-orange-500" />
          Mesas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {business.name}
        </p>
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

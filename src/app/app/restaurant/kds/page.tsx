import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, ShieldAlert, Construction } from "lucide-react";
import { resolveRestaurantBusinessId, listRestaurantOptions } from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_KITCHEN", "STAFF_BAR", "STAFF_WAITER",
];

export default async function KDSPlaceholder({
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
      <div className="p-6 max-w-xl mx-auto pb-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu rol no tiene permisos para acceder al KDS.
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

  if (!businessId) {
    return (
      <div className="p-6 max-w-xl mx-auto pb-24">
        <Card>
          <CardHeader><CardTitle>Sin restaurante asignado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes acceso a ningún restaurante.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [business, options, pendingCount] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    prisma.restaurantOrder.count({
      where: {
        businessId,
        status: "SENT",
        items: { some: { kitchenStatus: { in: ["NEW", "PREPARING"] } } },
      },
    }),
  ]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-orange-500" />
            Cocina (KDS)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{business?.name}</p>
        </div>

        <RestaurantSelector current={businessId} options={options} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Construction className="w-5 h-5 text-amber-500" />
            KDS rediseñado en construcción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <p className="font-medium text-blue-900">🚧 Próximamente en Fase 8C</p>
            <p className="text-xs text-blue-800 mt-1">
              La pantalla de cocina rediseñada llega después del POS (Fase 8B).
              Tendrá cards grandes, colores por urgencia, sonido al llegar nueva orden,
              y filtros por estación (cocina vs barra).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground uppercase">Órdenes pendientes</p>
              <p className="text-2xl font-bold mt-1">{pendingCount}</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground uppercase">Estado</p>
              <p className="text-sm mt-1 text-amber-600 font-medium">En desarrollo</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Por ahora puedes ver órdenes pendientes desde la vista de Mesas (las mesas con
            indicador 🔥 de cocina pendiente).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

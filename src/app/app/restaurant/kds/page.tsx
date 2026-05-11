import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, ShieldAlert } from "lucide-react";
import {
  resolveRestaurantBusinessId,
  listRestaurantOptions,
} from "@/lib/restaurant-resolve";
import { RestaurantSelector } from "@/components/restaurant/RestaurantSelector";
import { getKDSOrders } from "@/lib/kds.actions";
import { KDSClient } from "@/components/restaurant/KDSClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_KITCHEN", "STAFF_BAR", "STAFF_WAITER",
];

export default async function KDSPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; station?: string }>;
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

  // Station filter
  const rawStation = (sp.station ?? "ALL").toUpperCase();
  const station: "KITCHEN" | "BAR" | "ALL" =
    rawStation === "KITCHEN" ? "KITCHEN" :
    rawStation === "BAR" ? "BAR" : "ALL";

  // Si el usuario es STAFF_BAR, forzar barra
  const actualStation: "KITCHEN" | "BAR" | "ALL" =
    role === "STAFF_BAR" ? "BAR" :
    role === "STAFF_KITCHEN" ? "KITCHEN" :
    station;

  const [business, options, orders] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    listRestaurantOptions(userId, role),
    getKDSOrders({ businessId, station: actualStation }),
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

      <KDSClient
        businessId={businessId}
        station={actualStation}
        initialOrders={orders}
      />
    </div>
  );
}

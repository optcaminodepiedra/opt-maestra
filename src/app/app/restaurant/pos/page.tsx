import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, ShieldAlert } from "lucide-react";
import { resolveRestaurantBusinessId } from "@/lib/restaurant-resolve";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
];

export default async function POSIndexPage({
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
      <div className="p-6 max-w-xl mx-auto pb-24">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu rol no tiene permisos para acceder al POS.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = await resolveRestaurantBusinessId({
    queryBusinessId: sp.businessId,
    userId: me.id ?? "",
    userRole: role,
    userPrimaryBusinessId: me.primaryBusinessId,
  });

  // Si tiene un negocio, redirige a Mesas para que abra una orden ahí
  if (businessId) {
    redirect(`/app/restaurant/tables?businessId=${businessId}`);
  }

  return (
    <div className="p-6 max-w-xl mx-auto pb-24">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" /> POS
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>No tienes acceso a ningún restaurante con mesas configuradas.</p>
          <p>Contacta a un administrador para que te asigne acceso.</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { getOrderForPOS, getCashpointsForBusiness } from "@/lib/pos.actions";
import { POSClient } from "@/components/restaurant/POSClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
  "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
];

export default async function POSPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string };
  const role = me.role as string;

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tu rol no tiene permisos para usar el POS.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { orderId } = await params;

  let data;
  try {
    data = await getOrderForPOS(orderId);
  } catch (err: any) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {err.message || "No se pudo cargar la orden"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, menu } = data;
  const cashpoints = await getCashpointsForBusiness(order.businessId);

  return (
    <POSClient
      order={order as any}
      categories={menu.categories as any}
      categoryNames={menu.categoryNames}
      cashpoints={cashpoints}
      currentUserRole={role}
    />
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRestaurantBootData, getKdsItems } from "@/lib/restaurant.actions";
import { KDSBoard } from "@/components/restaurant/KDSBoard";

export default async function RestaurantKdsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const data = await getRestaurantBootData();
  const businessId = data.businessId!;
  const items = await getKdsItems(businessId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">KDS Cocina</h1>
        <p className="text-sm text-muted-foreground">
          Cola de preparación (Nuevo → Preparando → Listo).
        </p>
      </div>

      <KDSBoard items={items as any} />
    </div>
  );
}

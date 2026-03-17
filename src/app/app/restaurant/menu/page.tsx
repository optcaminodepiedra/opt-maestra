import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRestaurantBootData } from "@/lib/restaurant.actions";
import { MenuManager } from "@/components/restaurant/MenuManager";

type SP = Record<string, string | string[] | undefined>;

function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function RestaurantMenuPage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  const sp = props.searchParams ? await props.searchParams : undefined;

  const spBusinessId = pickOne(sp?.businessId) || pickOne(sp?.bid) || pickOne(sp?.business);
  const spCashpointId = pickOne(sp?.cashpointId) || pickOne(sp?.cp) || pickOne(sp?.cashpoint);

  const selectedBusinessId = allowedToSwitch ? spBusinessId : primaryBusinessId || undefined;

  const data = await getRestaurantBootData({
    businessId: selectedBusinessId,
    cashpointId: spCashpointId,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Menú</h1>
        <p className="text-sm text-muted-foreground">
          Alta/edición de productos por unidad y (opcional) por caja/local. Incluye control de categorías.
        </p>
      </div>

      <MenuManager data={data as any} me={{ role, allowedToSwitch }} />
    </div>
  );
}
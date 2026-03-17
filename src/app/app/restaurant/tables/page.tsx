import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRestaurantBootData } from "@/lib/restaurant.actions";
import { TablesManager } from "@/components/restaurant/TablesManager";

type SP = Record<string, string | string[] | undefined>;

function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function RestaurantTablesPage({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  // ✅ Next 16: searchParams puede venir como Promise
  const sp = (searchParams instanceof Promise) ? await searchParams : (searchParams ?? {});

  const spBusinessId =
    pickOne(sp?.businessId) ||
    pickOne(sp?.bid) ||
    pickOne(sp?.business);

  const spCashpointId =
    pickOne(sp?.cashpointId) ||
    pickOne(sp?.cp) ||
    pickOne(sp?.cashpoint);

  const selectedBusinessId = allowedToSwitch ? spBusinessId : primaryBusinessId || undefined;

  const data = await getRestaurantBootData({
    businessId: selectedBusinessId,
    cashpointId: spCashpointId,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mesas</h1>
        <p className="text-sm text-muted-foreground">
          Administración por unidad y (opcional) por caja/local.
        </p>
      </div>

      <TablesManager
        data={data as any}
        me={{ role, allowedToSwitch }}
      />
    </div>
  );
}
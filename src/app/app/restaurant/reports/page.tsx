import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRestaurantBootData, getRestaurantReportsData } from "@/lib/restaurant.actions";
import { RestaurantReports } from "@/components/restaurant/RestaurantReports";

type SP = Record<string, string | string[] | undefined>;
function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysAgoYYYYMMDD(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function RestaurantReportsPage({
  searchParams,
}: {
  searchParams?: Promise<SP> | SP;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  const sp = searchParams instanceof Promise ? await searchParams : (searchParams ?? {});
  const spBusinessId = pickOne(sp.businessId) || pickOne(sp.bid) || pickOne(sp.business);
  const spCashpointId = pickOne(sp.cashpointId) || pickOne(sp.cp) || pickOne(sp.cashpoint);
  const spFrom = pickOne(sp.from);
  const spTo = pickOne(sp.to);

  // Usamos boot para sacar lista de negocios (selector)
  const boot = await getRestaurantBootData({
    businessId: allowedToSwitch ? spBusinessId : primaryBusinessId || undefined,
    cashpointId: spCashpointId,
  });

  const businessId = boot.businessId;
  if (!businessId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">No hay unidad seleccionada.</p>
      </div>
    );
  }

  const from = spFrom || daysAgoYYYYMMDD(7);
  const to = spTo || todayYYYYMMDD();

  const report = await getRestaurantReportsData({
    businessId,
    from,
    to,
    cashpointId: spCashpointId || null,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reportes (Restaurante)</h1>
        <p className="text-sm text-muted-foreground">
          Ventas, top productos, categorías y desempeño por periodo.
        </p>
      </div>

      <RestaurantReports
        boot={boot as any}
        report={report as any}
        me={{ role, allowedToSwitch }}
      />
    </div>
  );
}
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getHotelDashboardData } from "@/lib/hotel.reports.actions";
import { HotelDashboard } from "@/components/hotel/HotelDashboard";

type SP = Record<string, string | string[] | undefined>;
function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HotelDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const sp = (await searchParams) ?? {};
  const spBusinessId = pickOne(sp.businessId);

  // ✅ Owner/Master puede switch; staff usa su primaryBusinessId
  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";
  const businessId = allowedToSwitch ? spBusinessId ?? undefined : primaryBusinessId ?? undefined;

  const data = await getHotelDashboardData({ businessId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Hotel · Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ocupación, estatus operativos, llegadas/salidas e ingresos.
        </p>
      </div>

      <HotelDashboard data={data as any} me={{ role, allowedToSwitch }} />
    </div>
  );
}
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getHotelBoot } from "@/lib/hotel.actions";
import { ReservationsManager } from "@/components/hotel/ReservationsManager";
import ReservationsCalendar from "@/components/hotel/ReservationsCalendar";
import OccupancyGrid from "@/components/hotel/OccupancyGrid";

type SP = Record<string, string | string[] | undefined>;

function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HotelReservationsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any).user?.id as string;
  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  const sp = (await searchParams) ?? {};
  const spBusinessId = pickOne(sp.businessId);
  const from = pickOne(sp.from);
  const to = pickOne(sp.to);

  const businessId = allowedToSwitch
    ? spBusinessId ?? undefined
    : primaryBusinessId ?? undefined;

  const boot = await getHotelBoot({ businessId, from, to });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reservas</h1>
        <p className="text-sm text-muted-foreground">
          Lista + calendario + grid de ocupación.
        </p>
      </div>

      <ReservationsCalendar reservations={boot.reservations} />

      <OccupancyGrid
  rooms={boot.rooms}
  reservations={(boot.reservations ?? []).map((r: any) => ({
    ...r,
    checkIn: r.checkIn?.toISOString?.() ?? r.checkIn,
    checkOut: r.checkOut?.toISOString?.() ?? r.checkOut,
  }))}
/>


<ReservationsManager
  boot={boot as any}
  me={{ userId, role }}
/>

    </div>
  );
}

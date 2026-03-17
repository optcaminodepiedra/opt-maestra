import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getHotelCalendarData } from "@/lib/hotel.calendar.actions";
import { HotelCalendar } from "@/components/hotel/HotelCalendar";

type SP = Record<string, string | string[] | undefined>;
function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HotelCalendarPage({
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
  const from = pickOne(sp.from);
  const to = pickOne(sp.to);

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";
  const businessId = allowedToSwitch ? spBusinessId ?? undefined : primaryBusinessId ?? undefined;

  const data = await getHotelCalendarData({ businessId, from, to });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendario por habitación</h1>
        <p className="text-sm text-muted-foreground">Vista tipo Gantt para rebooking operativo.</p>
      </div>

      <HotelCalendar data={data as any} me={{ role, allowedToSwitch }} />
    </div>
  );
}
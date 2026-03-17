import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { 
  getFrontDeskBoot,
  checkInReservation,
  checkOutReservation,
  addChargeToReservation
} from "@/lib/hotel.actions";
import { FrontDeskManager } from "@/components/hotel/FrontDeskManager";

type SP = Record<string, string | string[] | undefined>;
function pickOne(v?: string | string[]) {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function HotelFrontDeskPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user?.role as string;
  const primaryBusinessId = (session as any).user?.primaryBusinessId as string | null;

  const allowedToSwitch = role === "MASTER_ADMIN" || role === "OWNER";

  const sp = (await searchParams) ?? {};
  const spBusinessId = pickOne(sp.businessId);

  const businessId = allowedToSwitch
    ? spBusinessId ?? undefined
    : primaryBusinessId ?? undefined;

  const boot = await getFrontDeskBoot({ businessId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Front Desk</h1>
        <p className="text-sm text-muted-foreground">
          Llegadas hoy, salidas hoy, hospedados, check-in/out y cargos.
        </p>
      </div>

      <FrontDeskManager
  boot={boot as any}
  checkInReservation={checkInReservation}
  checkOutReservation={checkOutReservation}
  onAddCharge={addChargeToReservation}
/>
    </div>
  );
}
// src/app/app/hotel/frontdesk/page.tsx
import { getFrontDeskBoot } from "@/lib/hotel.actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FrontDeskClient } from "@/components/hotel/FrontDeskClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ businessId?: string }>;

export default async function FrontDeskPage(props: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await props.searchParams;
  const boot = await getFrontDeskBoot({ businessId: sp.businessId });

  const allowedToSwitch = (boot.businesses?.length || 0) > 1;

  if (!boot.businessId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Front Desk</h1>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No tienes hoteles asignados.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Front Desk</h1>
        <p className="text-sm text-slate-500">Llegadas, salidas y huéspedes en casa de hoy</p>
      </div>

      <FrontDeskClient
        businessId={boot.businessId}
        businesses={boot.businesses}
        userId={session.user.id}
        rooms={boot.rooms as any}
        arrivals={boot.arrivals as any}
        departures={boot.departures as any}
        inHouse={boot.inHouse as any}
        allowedToSwitch={allowedToSwitch}
      />
    </div>
  );
}

// src/app/app/hotel/housekeeping/page.tsx
import { getHousekeepingBoot } from "@/lib/hotel.actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import HousekeepingClient from "@/components/hotel/HousekeepingClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ businessId?: string }>;

export default async function HousekeepingPage(props: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await props.searchParams;
  const boot = await getHousekeepingBoot({ businessId: sp.businessId });

  if (!boot.businessId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Housekeeping</h1>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No tienes hoteles asignados.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Housekeeping</h1>
        <p className="text-sm text-slate-500">
          Priorizado por salidas de hoy, sucias y mantenimiento
        </p>
      </div>

      <HousekeepingClient
        businesses={boot.businesses}
        businessId={boot.businessId}
        rooms={boot.rooms as any}
        todayArrivals={boot.todayArrivals as any}
        todayCheckOuts={boot.todayCheckOuts as any}
      />
    </div>
  );
}

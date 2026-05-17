// src/app/app/hotel/reservations/page.tsx
import { getHotelBoot } from "@/lib/hotel.actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HotelReservationGrid } from "@/components/hotel/HotelReservationGrid";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ businessId?: string; from?: string; to?: string }>;

export default async function ReservationsPage(props: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await props.searchParams;
  const boot = await getHotelBoot({
    businessId: sp.businessId,
    from: sp.from,
    to: sp.to,
  });

  // Si el usuario solo tiene 1 hotel, no permitimos cambio
  const allowedToSwitch = (boot.businesses?.length || 0) > 1;

  if (!boot.businessId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reservaciones</h1>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          No tienes hoteles asignados. Pide a un administrador que te asigne acceso.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Reservaciones</h1>
        <p className="text-sm text-slate-500">Calendario visual de habitaciones</p>
      </div>

      <HotelReservationGrid
        businesses={boot.businesses}
        businessId={boot.businessId}
        rooms={boot.rooms as any}
        reservations={boot.reservations as any}
        userId={session.user.id}
        allowedToSwitch={allowedToSwitch}
      />
    </div>
  );
}

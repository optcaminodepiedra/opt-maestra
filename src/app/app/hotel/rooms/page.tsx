// src/app/app/hotel/rooms/page.tsx
import { getHotelBoot } from "@/lib/hotel.actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import HotelRoomsClient from "@/components/hotel/HotelRoomsClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ businessId?: string }>;

export default async function RoomsPage(props: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sp = await props.searchParams;
  const boot = await getHotelBoot({ businessId: sp.businessId });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Habitaciones</h1>
        <p className="text-sm text-slate-500">Inventario, tipos y estados</p>
      </div>

      <HotelRoomsClient
        businesses={boot.businesses}
        businessId={boot.businessId}
        roomTypes={boot.roomTypes as any}
        rooms={boot.rooms as any}
      />
    </div>
  );
}

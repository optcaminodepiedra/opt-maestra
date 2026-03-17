"use server";
import { getHotelBusinesses, pickDefaultHotelBusinessId } from "@/lib/hotel.business";
import { prisma } from "@/lib/prisma";

function parseYmd(s?: string) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getHotelCalendarData(input?: { businessId?: string; from?: string; to?: string }) {
  const businesses = await getHotelBusinesses();
const bid = input?.businessId ?? pickDefaultHotelBusinessId(businesses);
  if (!bid) {
    return { businesses, businessId: null, from: null, to: null, rooms: [], reservations: [] };
  }

  const fromDate = parseYmd(input?.from) ?? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12);
  const toDate = parseYmd(input?.to) ?? new Date(fromDate.getTime() + 86400000 * 30);

const rooms = await prisma.hotelRoom.findMany({
  where: { businessId: bid, isActive: true },
  orderBy: [{ name: "asc" }],
  select: {
    id: true,
    name: true,
    status: true,
    roomType: { select: { name: true } },
  },
});

  // reservas que intersectan el rango
const reservations = await prisma.hotelReservation.findMany({
  where: {
    businessId: bid,
    status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
    AND: [
      { checkIn: { lt: toDate } },
      { checkOut: { gt: fromDate } },
    ],
  },
  orderBy: [{ checkIn: "asc" }],
  select: {
    id: true,
    status: true,
    checkIn: true,
    checkOut: true,
    roomId: true,
    guest: { select: { fullName: true } },
  },
});

  return {
    businesses,
    businessId: bid,
    from: ymd(fromDate),
    to: ymd(toDate),
    rooms,
    reservations,
  };
}
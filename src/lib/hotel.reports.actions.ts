"use server";
import { getHotelBusinesses, pickDefaultHotelBusinessId } from "@/lib/hotel.business";
import { prisma } from "@/lib/prisma";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  x.setDate(x.getDate() - diff);
  return startOfDay(x);
}

export async function getHotelDashboardData(input?: { businessId?: string }) {
  const businesses = await getHotelBusinesses();
const bid = input?.businessId ?? pickDefaultHotelBusinessId(businesses);

  if (!bid) {
    return {
      businesses,
      businessId: null,
      kpis: null,
      arrivalsToday: [],
      departuresToday: [],
      alerts: [],
    };
  }

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date());

  // ✅ Rooms status snapshot (modelo correcto: hotelRoom)
  const rooms = await prisma.hotelRoom.findMany({
    where: { businessId: bid, isActive: true },
    select: { id: true, status: true },
  });

  const totalRooms = rooms.length;
  const byStatus = rooms.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const available = (byStatus["AVAILABLE"] ?? 0) + (byStatus["READY"] ?? 0);
  const occupied = byStatus["OCCUPIED"] ?? 0;
  const dirty = byStatus["DIRTY"] ?? 0;
  const cleaning = byStatus["CLEANING"] ?? 0;
  const outOfService =
    (byStatus["OUT_OF_SERVICE"] ?? 0) + (byStatus["MAINTENANCE"] ?? 0);

  const occupancyPct = totalRooms
    ? Math.round((occupied / totalRooms) * 100)
    : 0;

  // ✅ Arrivals/Departures (modelo correcto: hotelReservation)
  // IMPORTANTE: NO pedimos totalCents/depositCents porque NO existen en tu schema.
  const arrivalsToday = await prisma.hotelReservation.findMany({
    where: {
      businessId: bid,
      status: { in: ["CONFIRMED", "PENDING"] },
      checkIn: { gte: todayStart, lte: todayEnd },
    },
    orderBy: [{ checkIn: "asc" }],
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      room: { select: { name: true } },
      guest: { select: { fullName: true, phone: true } },
      charges: { select: { amountCents: true } }, // ✅ para monto visible
    },
  });

  const departuresToday = await prisma.hotelReservation.findMany({
    where: {
      businessId: bid,
      status: { in: ["CHECKED_IN", "CONFIRMED"] },
      checkOut: { gte: todayStart, lte: todayEnd },
    },
    orderBy: [{ checkOut: "asc" }],
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      room: { select: { name: true } },
      guest: { select: { fullName: true, phone: true } },
      charges: { select: { amountCents: true } },
    },
  });

  // ✅ Revenue: día/semana desde cargos (HotelCharge)
  // (Luego lo movemos a Folio/Pagos como fuente real)
  const chargesDay = await prisma.hotelCharge.aggregate({
    where: { businessId: bid, createdAt: { gte: todayStart, lte: todayEnd } },
    _sum: { amountCents: true },
  });

  const chargesWeek = await prisma.hotelCharge.aggregate({
    where: { businessId: bid, createdAt: { gte: weekStart, lte: todayEnd } },
    _sum: { amountCents: true },
  });

  const dayRevenueCents = chargesDay._sum.amountCents ?? 0;
  const weekRevenueCents = chargesWeek._sum.amountCents ?? 0;

  // ✅ Alerts (básicas)
  const alerts: Array<{ type: string; text: string }> = [];
  if (dirty > 0) alerts.push({ type: "DIRTY", text: `Hay ${dirty} habitaciones marcadas como DIRTY.` });
  if (outOfService > 0) alerts.push({ type: "OOS", text: `Hay ${outOfService} habitaciones fuera de servicio / mantenimiento.` });
  if (arrivalsToday.length > 0) alerts.push({ type: "ARRIVALS", text: `Llegadas hoy: ${arrivalsToday.length}.` });
  if (departuresToday.length > 0) alerts.push({ type: "DEPARTURES", text: `Salidas hoy: ${departuresToday.length}.` });

  return {
    businesses,
    businessId: bid,
    kpis: {
      totalRooms,
      occupancyPct,
      available,
      occupied,
      dirty,
      cleaning,
      outOfService,
      dayRevenueCents,
      weekRevenueCents,
    },
    arrivalsToday,
    departuresToday,
    alerts,
  };
}
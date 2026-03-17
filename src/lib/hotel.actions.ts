"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ReservationStatus, RoomStatus, RoomTypeKind } from "@prisma/client";
import { getHotelBusinesses, pickDefaultHotelBusinessId } from "@/lib/hotel.business";

function rv() {
  revalidatePath("/app/hotel");
  revalidatePath("/app/hotel/dashboard");
  revalidatePath("/app/hotel/rooms");
  revalidatePath("/app/hotel/reservations");
  revalidatePath("/app/hotel/frontdesk");
  revalidatePath("/app/hotel/housekeeping");
  revalidatePath("/app/hotel/reports");
}

function pickDefaultBusinessId(businesses: { id: string; name: string }[]) {
  // Preferimos hoteles/contendedores por nombre (ajústalo si quieres)
  const prefer = ["Hotel", "Tierra Adentro", "Camino de Piedra", "Rancho"];
  for (const p of prefer) {
    const hit = businesses.find((b) => (b.name || "").toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit.id;
  }
  return businesses[0]?.id ?? null;
}

export async function getHotelBoot(input?: {
  businessId?: string;
  // rango opcional para reservas/reportes
  from?: string; // ISO
  to?: string;   // ISO
}) {
  const businesses = await getHotelBusinesses();
const businessId = input?.businessId || pickDefaultHotelBusinessId(businesses);
  if (!businessId) {
    return {
      businesses,
      businessId: null,
      roomTypes: [],
      rooms: [],
      reservations: [],
      stats: null,
    };
  }

  const roomTypes = await prisma.hotelRoomType.findMany({
    where: { businessId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const rooms = await prisma.hotelRoom.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { roomType: true },
  });

  // rango para reservas (por default: hoy→+30 días)
  const fromDate = input?.from ? new Date(input.from) : new Date();
  const toDate = input?.to ? new Date(input.to) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const reservations = await prisma.hotelReservation.findMany({
    where: {
      businessId,
      // intersecta rango
      AND: [
        { checkIn: { lt: toDate } },
        { checkOut: { gt: fromDate } },
      ],
      status: { notIn: ["CANCELED"] },
    },
    orderBy: [{ checkIn: "asc" }],
    include: {
      room: { include: { roomType: true } },
      guest: true,
      charges: true,
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
  });

  // stats rápidas
  const totalActiveRooms = rooms.length;
  const byStatus = rooms.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const occupied = byStatus["OCCUPIED"] || 0;
  const occupancyPct = totalActiveRooms ? Math.round((occupied / totalActiveRooms) * 100) : 0;

  const stats = {
    totalActiveRooms,
    occupancyPct,
    byStatus,
  };

  return { businesses, businessId, roomTypes, rooms, reservations, stats };
}

export async function createRoomType(input: {
  businessId: string;
  name: string;
  description?: string;
  basePrice: number; // MXN
  capacity: number;
  kind?: RoomTypeKind;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.name?.trim()) throw new Error("Falta nombre");
  const basePriceCents = Math.round((input.basePrice || 0) * 100);
  if (basePriceCents <= 0) throw new Error("Precio inválido");
  const capacity = Math.max(1, Math.floor(input.capacity || 1));

  await prisma.hotelRoomType.create({
    data: {
      businessId: input.businessId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      basePriceCents,
      capacity,
      kind: input.kind ?? "STANDARD",
    },
  });

  rv();
  return true;
}

export async function createRoom(input: {
  businessId: string;
  roomTypeId: string;
  name: string;
  floor?: string;
  area?: string;
  sortOrder?: number;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.roomTypeId) throw new Error("Falta tipo");
  if (!input.name?.trim()) throw new Error("Falta nombre");

  await prisma.hotelRoom.create({
    data: {
      businessId: input.businessId,
      roomTypeId: input.roomTypeId,
      name: input.name.trim(),
      floor: input.floor?.trim() || null,
      area: input.area?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      status: "AVAILABLE",
      isActive: true,
    },
  });

  rv();
  return true;
}

export async function setRoomStatus(input: { roomId: string; status: RoomStatus }) {
  if (!input.roomId) throw new Error("Falta roomId");

  await prisma.hotelRoom.update({
    where: { id: input.roomId },
    data: { status: input.status },
  });

  rv();
  return true;
}

export async function upsertGuest(input: {
  fullName: string;
  phone?: string;
  email?: string;
  documentId?: string;
}) {
  const fullName = input.fullName?.trim();
  if (!fullName) throw new Error("Falta nombre del huésped");

  // heurística simple: si trae email, intenta match por email; si no, por nombre+tel
  const email = input.email?.trim()?.toLowerCase() || null;
  const phone = input.phone?.trim() || null;

  const existing = await prisma.hotelGuest.findFirst({
    where: email
      ? { email }
      : phone
      ? { phone, fullName }
      : { fullName },
  });

  if (existing) {
    const upd = await prisma.hotelGuest.update({
      where: { id: existing.id },
      data: {
        fullName,
        phone,
        email,
        documentId: input.documentId?.trim() || null,
      },
    });
    return upd;
  }

  return prisma.hotelGuest.create({
    data: {
      fullName,
      phone,
      email,
      documentId: input.documentId?.trim() || null,
    },
  });
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  // overlap si: aStart < bEnd && aEnd > bStart
  return aStart < bEnd && aEnd > bStart;
}

export async function createReservation(input: {
  businessId: string;
  roomId: string;
  userId: string;

  guestFullName: string;
  guestPhone?: string;
  guestEmail?: string;
  guestDocumentId?: string;

  checkIn: string;  // ISO
  checkOut: string; // ISO

  adults?: number;
  children?: number;

  total: number;    // MXN
  deposit?: number; // MXN
  note?: string;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.roomId) throw new Error("Falta habitación");
  if (!input.userId) throw new Error("Falta userId");

  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (isNaN(checkIn.getTime())) throw new Error("checkIn inválido");
  if (isNaN(checkOut.getTime())) throw new Error("checkOut inválido");
  if (checkOut <= checkIn) throw new Error("checkOut debe ser > checkIn");

  const totalCents = Math.round((input.total || 0) * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) throw new Error("Total inválido");

  const depositCents = Math.max(0, Math.round((input.deposit || 0) * 100));

  // validar room existe y pertenece al business
  const room = await prisma.hotelRoom.findUnique({ where: { id: input.roomId } });
  if (!room || room.businessId !== input.businessId) throw new Error("Habitación inválida");

  // validar disponibilidad (sin overbooking por ahora)
  const existing = await prisma.hotelReservation.findMany({
    where: {
      businessId: input.businessId,
      roomId: input.roomId,
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      AND: [
        { checkIn: { lt: checkOut } },
        { checkOut: { gt: checkIn } },
      ],
    },
    select: { id: true, checkIn: true, checkOut: true, status: true },
  });

  for (const r of existing) {
    // overlap si: aStart < bEnd && aEnd > bStart
    if (checkIn < r.checkOut && checkOut > r.checkIn) {
      throw new Error("La habitación ya tiene reserva en ese rango");
    }
  }

  const guest = await upsertGuest({
    fullName: input.guestFullName,
    phone: input.guestPhone,
    email: input.guestEmail,
    documentId: input.guestDocumentId,
  });

  await prisma.hotelReservation.create({
    data: {
      businessId: input.businessId,
      roomId: input.roomId,
      guestId: guest.id,
      userId: input.userId,
      checkIn: checkIn,
      checkOut: checkOut,
      status: "CONFIRMED",
      adults: Math.max(1, Math.floor(input.adults || 1)),
      children: Math.max(0, Math.floor(input.children || 0)),
      totalCents,
      depositCents,
      notes: input.note?.trim() || null,
  },
});

rv();
return true;
}

export async function checkInReservation(input: { reservationId: string }) {
  if (!input.reservationId) throw new Error("Falta reservationId");

  const r = await prisma.hotelReservation.findUnique({
    where: { id: input.reservationId },
    include: { room: true },
  });
  if (!r) throw new Error("Reserva no existe");
  if (r.status !== "CONFIRMED" && r.status !== "PENDING") throw new Error("Reserva no está lista para check-in");

  await prisma.$transaction([
    prisma.hotelReservation.update({
      where: { id: r.id },
      data: { status: "CHECKED_IN" },
    }),
    prisma.hotelRoom.update({
      where: { id: r.roomId },
      data: { status: "OCCUPIED" },
    }),
  ]);

  
  rv();
  return true;
}

export async function checkOutReservation(input: { reservationId: string }) {
  if (!input.reservationId) throw new Error("Falta reservationId");

  const r = await prisma.hotelReservation.findUnique({
    where: { id: input.reservationId },
    include: { room: true },
  });
  if (!r) throw new Error("Reserva no existe");
  if (r.status !== "CHECKED_IN") throw new Error("Solo se puede hacer check-out de una reserva CHECKED_IN");

  await prisma.$transaction([
    prisma.hotelReservation.update({
      where: { id: r.id },
      data: { status: "CHECKED_OUT" },
    }),
    prisma.hotelRoom.update({
      where: { id: r.roomId },
      data: { status: "DIRTY" }, // al salir queda sucia por default
    }),
  ]);

  rv();
  return true;
}

export async function cancelReservation(input: { reservationId: string; reason?: string }) {
  if (!input.reservationId) throw new Error("Falta reservationId");

  await prisma.hotelReservation.update({
    where: { id: input.reservationId },
    data: { status: "CANCELED", notes: input.reason?.trim() || null },
  });

  rv();
  return true;
}

export async function addChargeToReservation(input: {
  reservationId: string;
  concept: string;
  amount: number; // MXN
}) {
  if (!input.reservationId) throw new Error("Falta reservationId");
  if (!input.concept?.trim()) throw new Error("Falta concepto");
  const amountCents = Math.round((input.amount || 0) * 100);
  if (amountCents <= 0) throw new Error("Monto inválido");

  const reservation = await prisma.hotelReservation.findUnique({
    where: { id: input.reservationId },
    select: { businessId: true },
  });

  if (!reservation) throw new Error("Reservación no encontrada");

  await prisma.hotelCharge.create({
    data: {
      reservationId: input.reservationId,
      concept: input.concept.trim(),
      amountCents,
      businessId: reservation.businessId,
    },
  });

  rv();
  return true;
}

export async function setReservationStatus(input: { reservationId: string; status: ReservationStatus }) {
  if (!input.reservationId) throw new Error("Falta reservationId");
  await prisma.hotelReservation.update({
    where: { id: input.reservationId },
    data: { status: input.status },
  });
  rv();
  return true;
}

// ==============================
// ✅ UPDATES / DELETES RoomTypes / Rooms
// ==============================

export async function updateRoomType(input: {
  id: string;
  name?: string;
  description?: string | null;
  basePrice?: number; // MXN
  capacity?: number;
  kind?: RoomTypeKind;
}) {
  if (!input.id) throw new Error("Falta id");

  const data: any = {};
  if (typeof input.name === "string") data.name = input.name.trim();
  if (typeof input.description !== "undefined") data.description = input.description ? input.description.trim() : null;
  if (typeof input.capacity !== "undefined") data.capacity = Math.max(1, Math.floor(input.capacity || 1));
  if (typeof input.kind !== "undefined") data.kind = input.kind;

  if (typeof input.basePrice !== "undefined") {
    const basePriceCents = Math.round((input.basePrice || 0) * 100);
    if (basePriceCents <= 0) throw new Error("Precio inválido");
    data.basePriceCents = basePriceCents;
  }

  await prisma.hotelRoomType.update({ where: { id: input.id }, data });
  rv();
  return true;
}

export async function deleteRoomType(input: { id: string }) {
  if (!input.id) throw new Error("Falta id");
  // si tiene rooms asociados, truena. (mejor que sea explícito)
  await prisma.hotelRoomType.delete({ where: { id: input.id } });
  rv();
  return true;
}

export async function updateRoom(input: {
  id: string;
  name?: string;
  floor?: string | null;
  area?: string | null;
  sortOrder?: number;
  roomTypeId?: string;
  isActive?: boolean;
}) {
  if (!input.id) throw new Error("Falta id");

  const data: any = {};
  if (typeof input.name === "string") data.name = input.name.trim();
  if (typeof input.floor !== "undefined") data.floor = input.floor ? input.floor.trim() : null;
  if (typeof input.area !== "undefined") data.area = input.area ? input.area.trim() : null;
  if (typeof input.sortOrder !== "undefined") data.sortOrder = input.sortOrder ?? 0;
  if (typeof input.roomTypeId === "string") data.roomTypeId = input.roomTypeId;
  if (typeof input.isActive !== "undefined") data.isActive = !!input.isActive;

  await prisma.hotelRoom.update({ where: { id: input.id }, data });
  rv();
  return true;
}

// ==============================
// ✅ RESERVATIONS: update / no-show
// ==============================

export async function updateReservation(input: {
  id: string;
  checkIn?: string;   // ISO
  checkOut?: string;  // ISO
  adults?: number;
  children?: number;
  total?: number;   // MXN
  deposit?: number; // MXN
  note?: string | null;
  roomId?: string;
}) {
  if (!input.id) throw new Error("Falta id");

  const r = await prisma.hotelReservation.findUnique({ where: { id: input.id } });
  if (!r) throw new Error("Reserva no existe");

  const data: any = {};

  // room change + disponibilidad
  const nextRoomId = input.roomId ?? r.roomId;

  const nextCheckIn = input.checkIn ? new Date(input.checkIn) : r.checkIn;
  const nextCheckOut = input.checkOut ? new Date(input.checkOut) : r.checkOut;
  if (nextCheckOut <= nextCheckIn) throw new Error("checkOut debe ser > checkIn");

  // validar disponibilidad (excluyendo esta reserva)
  const clashes = await prisma.hotelReservation.findMany({
    where: {
      businessId: r.businessId,
      roomId: nextRoomId,
      id: { not: r.id },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
      AND: [{ checkIn: { lt: nextCheckOut } }, { checkOut: { gt: nextCheckIn } }],
    },
    select: { id: true },
  });
  if (clashes.length) throw new Error("La habitación ya tiene reserva en ese rango");

  data.roomId = nextRoomId;
  data.checkIn = nextCheckIn;
  data.checkOut = nextCheckOut;

  if (typeof input.adults !== "undefined") data.adults = Math.max(1, Math.floor(input.adults || 1));
  if (typeof input.children !== "undefined") data.children = Math.max(0, Math.floor(input.children || 0));

  if (typeof input.total !== "undefined") {
    const totalCents = Math.round((input.total || 0) * 100);
    if (totalCents <= 0) throw new Error("Total inválido");
    data.totalCents = totalCents;
  }
  if (typeof input.deposit !== "undefined") {
    data.depositCents = Math.max(0, Math.round((input.deposit || 0) * 100));
  }
  if (typeof input.note !== "undefined") {
    data.notes = input.note ? input.note.trim() : null;
  }

  await prisma.hotelReservation.update({ where: { id: input.id }, data });
  rv();
  return true;
}

export async function markNoShow(input: { reservationId: string }) {
  if (!input.reservationId) throw new Error("Falta id");
  await prisma.hotelReservation.update({
    where: { id: input.reservationId },
    data: { status: "NO_SHOW" },
  });
  rv();
  return true;
}

// ==============================
// ✅ FRONT DESK BOOT (Llegadas / Salidas / In-house)
// ==============================

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function getFrontDeskBoot(input?: { businessId?: string }) {
  const businesses = await getHotelBusinesses();
const businessId = input?.businessId || pickDefaultHotelBusinessId(businesses);
  if (!businessId) {
    return { businesses, businessId: null, arrivals: [], departures: [], inHouse: [], rooms: [] };
  }

  const rooms = await prisma.hotelRoom.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { roomType: true },
  });

  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());

  // Llegadas: check-in date hoy, status CONFIRMED/PENDING
  const arrivals = await prisma.hotelReservation.findMany({
    where: {
      businessId,
      status: { in: ["PENDING", "CONFIRMED"] },
      checkIn: { gte: dayStart, lte: dayEnd },
    },
    orderBy: [{ checkIn: "asc" }],
    include: { guest: true, room: { include: { roomType: true } }, charges: true },
  });

  // Salidas: check-out hoy, status CHECKED_IN
  const departures = await prisma.hotelReservation.findMany({
    where: {
      businessId,
      status: "CHECKED_IN",
      checkOut: { gte: dayStart, lte: dayEnd },
    },
    orderBy: [{ checkOut: "asc" }],
    include: { guest: true, room: { include: { roomType: true } }, charges: true },
  });

  // Hospedados: CHECKED_IN (aunque no salgan hoy)
  const inHouse = await prisma.hotelReservation.findMany({
    where: { businessId, status: "CHECKED_IN" },
    orderBy: [{ checkIn: "asc" }],
    include: { guest: true, room: { include: { roomType: true } }, charges: true },
  });

  return { businesses, businessId, arrivals, departures, inHouse, rooms };
}
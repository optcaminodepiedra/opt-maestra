import { prisma } from "@/lib/prisma";
import type { ScheduledShiftStatus } from "@prisma/client";

export type TodayShiftRow = {
  shiftId: string;
  userId: string;
  fullName: string;
  jobTitle: string | null;
  role: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  status: ScheduledShiftStatus;
  hasClockedIn: boolean;
  totalMinutesToday: number;
};

/** Devuelve YYYY-MM-DD en la zona local del servidor. */
export function isoDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convierte YYYY-MM-DD a Date (UTC 00:00) — @db.Date lo guarda sin horas. */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Plantilla de trabajo de un día para un negocio.
 * Cruza ScheduledShift con WorkDay para saber si ya checó.
 */
export async function getShiftsForDay(
  businessId: string,
  dateIso: string
): Promise<TodayShiftRow[]> {
  const day = dateOnly(dateIso);

  const shifts = await prisma.scheduledShift.findMany({
    where: { businessId, date: day },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          jobTitle: true,
        },
      },
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });

  if (shifts.length === 0) return [];

  const userIds = shifts.map((s) => s.userId);
  const workDays = await prisma.workDay.findMany({
    where: { userId: { in: userIds }, date: day },
    select: { userId: true, status: true, totalMinutes: true },
  });
  const workDayByUser = new Map(workDays.map((w) => [w.userId, w]));

  return shifts.map((s) => {
    const wd = workDayByUser.get(s.userId);
    return {
      shiftId: s.id,
      userId: s.userId,
      fullName: s.user.fullName,
      jobTitle: s.user.jobTitle,
      role: s.role,
      startTime: s.startTime,
      endTime: s.endTime,
      note: s.note,
      status: s.status,
      hasClockedIn: !!wd,
      totalMinutesToday: wd?.totalMinutes ?? 0,
    };
  });
}

/**
 * Plantilla de toda una semana para un negocio.
 * weekStartIso debe ser un lunes (YYYY-MM-DD).
 */
export async function getShiftsForWeek(businessId: string, weekStartIso: string) {
  const start = dateOnly(weekStartIso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return prisma.scheduledShift.findMany({
    where: {
      businessId,
      date: { gte: start, lt: end },
    },
    include: {
      user: { select: { id: true, fullName: true, jobTitle: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

/**
 * Empleados candidatos para programar: activos, ligados al negocio
 * (por businessId primario, primaryBusinessId, o vía UserBusinessAccess).
 */
export async function getCandidateUsersForBusiness(businessId: string) {
  // Primero los que tienen businessId o primaryBusinessId directamente
  const direct = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { businessId },
        { primaryBusinessId: businessId },
      ],
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      jobTitle: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });

  // Después los que tienen acceso multi-negocio
  const multiAccess = await prisma.user.findMany({
    where: {
      isActive: true,
      businessAccess: { some: { businessId } },
      NOT: {
        OR: [
          { businessId },
          { primaryBusinessId: businessId },
        ],
      },
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      jobTitle: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });

  // Unir y deduplicar por si acaso
  const seen = new Set<string>();
  const all = [...direct, ...multiAccess].filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  return all;
}

/** Devuelve el lunes de la semana actual en formato ISO (YYYY-MM-DD). */
export function currentWeekMondayIso(from: Date = new Date()): string {
  const d = new Date(from);
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diffToMonday);
  return isoDate(d);
}

/** Reconcilia turnos pasados: los PLANNED de ayer sin WorkDay pasan a ABSENT. */
export async function reconcilePastShifts(businessId: string) {
  const todayIso = isoDate();
  const today = dateOnly(todayIso);

  const stale = await prisma.scheduledShift.findMany({
    where: {
      businessId,
      status: "PLANNED",
      date: { lt: today },
    },
    select: { id: true, userId: true, date: true },
  });

  if (stale.length === 0) return { reconciled: 0 };

  const workDays = await prisma.workDay.findMany({
    where: {
      userId: { in: stale.map((s) => s.userId) },
      date: { in: stale.map((s) => s.date) },
    },
    select: { userId: true, date: true },
  });
  const checkedInKey = new Set(
    workDays.map((w) => `${w.userId}_${isoDate(w.date)}`)
  );

  let reconciled = 0;
  for (const s of stale) {
    const key = `${s.userId}_${isoDate(s.date)}`;
    const nextStatus = checkedInKey.has(key) ? "CONFIRMED" : "ABSENT";
    await prisma.scheduledShift.update({
      where: { id: s.id },
      data: { status: nextStatus },
    });
    reconciled++;
  }

  return { reconciled };
}
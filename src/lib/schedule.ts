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

// ═══════════════════════════════════════════════════════════════
// ZONA HORARIA MÉXICO (UTC-6, sin DST desde 2022)
// ═══════════════════════════════════════════════════════════════
const TZ = "America/Mexico_City";

/**
 * Devuelve YYYY-MM-DD en zona México (independiente del servidor).
 *
 * Funciona así:
 *   - Toma un Date (ej. "ahora")
 *   - Lo formatea con Intl en zona México
 *   - Devuelve el string del día EN MÉXICO
 *
 * Ejemplo:
 *   Servidor en UTC: new Date() = 2026-05-11T16:50:00Z
 *   En México son las 10:50 AM del 11 de mayo
 *   isoDate() → "2026-05-11" ✓
 */
export function isoDate(d: Date = new Date()): string {
  // en-CA da formato YYYY-MM-DD nativo
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/**
 * Convierte YYYY-MM-DD a Date.
 *
 * Guarda como "medianoche en México" pero expresada en UTC:
 *   - "2026-05-11" en México = 2026-05-11T06:00:00Z (UTC)
 *
 * Esto asegura que cuando formatees el Date en cualquier cliente
 * con zona México, te muestre el día correcto.
 *
 * Importante: si el cliente está en otra zona, igual mostrará el día
 * correcto porque el Date apunta a un momento real que cae dentro del
 * "día" en México.
 */
export function dateOnly(iso: string): Date {
  // Construir manualmente: medianoche México (UTC-6) = 06:00:00 UTC
  // Sin DST porque México lo eliminó en 2022
  return new Date(`${iso}T06:00:00.000Z`);
}

/**
 * Devuelve el lunes de la semana actual EN MÉXICO en formato ISO.
 */
export function currentWeekMondayIso(from: Date = new Date()): string {
  // Sacar la fecha de hoy en México
  const todayIso = isoDate(from);
  const [y, m, d] = todayIso.split("-").map(Number);

  // Crear Date con esos componentes (UTC para evitar drift)
  const tempDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = tempDate.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  tempDate.setUTCDate(tempDate.getUTCDate() + diffToMonday);

  const yy = tempDate.getUTCFullYear();
  const mm = String(tempDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(tempDate.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Formatea un Date para mostrar en UI (cliente o server)
 * usando la zona horaria de México.
 */
export function formatMxDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Formatea una hora (ej "14:30") con zona México.
 */
export function formatMxTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE DATA (sin cambios mayores)
// ═══════════════════════════════════════════════════════════════

/**
 * Plantilla de trabajo de un día para un negocio.
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

export async function getCandidateUsersForBusiness(businessId: string) {
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

  const seen = new Set<string>();
  const all = [...direct, ...multiAccess].filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  return all;
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

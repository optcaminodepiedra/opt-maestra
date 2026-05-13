import { prisma } from "@/lib/prisma";
import type { ScheduledShiftStatus } from "@prisma/client";

const TZ = "America/Mexico_City";

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
// HELPERS DE FECHA — siempre zona México
// ═══════════════════════════════════════════════════════════════

/**
 * Devuelve YYYY-MM-DD en zona México (no en zona del servidor).
 */
export function isoDate(d: Date = new Date()): string {
  // Si recibimos un Date que vino de @db.Date (UTC fix con mediodía o medianoche),
  // usamos UTC getters para no aplicar TZ.
  // Si es un Date "ahora", usamos Intl con TZ México.

  // Detección: si la hora UTC es exactamente 00:00:00 o 12:00:00, es @db.Date
  if (d.getUTCMilliseconds() === 0 && d.getUTCSeconds() === 0 && d.getUTCMinutes() === 0) {
    const h = d.getUTCHours();
    if (h === 0 || h === 12) {
      // Es @db.Date — usar UTC getters
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }

  // Es un timestamp normal — usar zona México
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
 * Convierte string "YYYY-MM-DD" a Date.
 * Usa mediodía UTC para evitar drift de timezone.
 */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/**
 * Devuelve el lunes de la semana actual EN MÉXICO en formato ISO.
 */
export function currentWeekMondayIso(from: Date = new Date()): string {
  const todayIso = isoDate(from);
  const [y, m, d] = todayIso.split("-").map(Number);

  const tempDate = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = tempDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  tempDate.setUTCDate(tempDate.getUTCDate() + diffToMonday);

  const yy = tempDate.getUTCFullYear();
  const mm = String(tempDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(tempDate.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Formatea una fecha ISO "YYYY-MM-DD" para mostrar en UI (sin Date object).
 */
export function formatDateMx(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const tempDate = new Date(Date.UTC(y, m - 1, d));
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dias[tempDate.getUTCDay()]} ${d} ${meses[m - 1]}`;
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE DATA (sin cambios mayores)
// ═══════════════════════════════════════════════════════════════

export async function getShiftsForDay(
  businessId: string,
  dateIso: string
): Promise<TodayShiftRow[]> {
  const day = dateOnly(dateIso);

  const shifts = await prisma.scheduledShift.findMany({
    where: { businessId, date: day },
    include: {
      user: { select: { id: true, fullName: true, jobTitle: true } },
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
      OR: [{ businessId }, { primaryBusinessId: businessId }],
    },
    select: { id: true, fullName: true, username: true, jobTitle: true, role: true },
    orderBy: { fullName: "asc" },
  });

  const multiAccess = await prisma.user.findMany({
    where: {
      isActive: true,
      businessAccess: { some: { businessId } },
      NOT: { OR: [{ businessId }, { primaryBusinessId: businessId }] },
    },
    select: { id: true, fullName: true, username: true, jobTitle: true, role: true },
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

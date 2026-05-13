"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";

const TZ = "America/Mexico_City";

// ═══════════════════════════════════════════════════════════════
// HELPERS DE FECHA — siempre zona México
// ═══════════════════════════════════════════════════════════════

/**
 * Convierte string "YYYY-MM-DD" a Date.
 *
 * IMPORTANTE: Como ScheduledShift.date es @db.Date, Postgres SOLO guarda
 * el día (sin hora ni zona). Usamos T12:00:00Z (mediodía UTC) para que
 * cuando se lea de vuelta y se convierta a México, NUNCA caiga al día
 * anterior por la conversión de zona horaria.
 *
 * Esto sigue funcionando porque Postgres ignora la parte de hora al
 * almacenar en @db.Date.
 */
function dateOnlyMx(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/**
 * Convierte Date @db.Date a string "YYYY-MM-DD".
 * Usa UTC getters para evitar conversión por zona horaria.
 */
function dateToIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Devuelve la fecha actual de México en formato "YYYY-MM-DD".
 */
function todayMexicoIso(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/* ═══════════════════════════ Helpers de permisos ═══════════════════════════ */

async function assertManagerForBusiness(businessId: string) {
  const me = await getMe();
  if (!isManager({ role: me.role as string })) {
    throw new Error("Sin permisos para programar turnos.");
  }

  if (["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(me.role as string)) {
    return me;
  }

  if ((me as any).primaryBusinessId === businessId) return me;

  try {
    const access = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "UserBusinessAccess"
      WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
      LIMIT 1
    `;
    if (access.length > 0) return me;
  } catch {}

  throw new Error("No tienes acceso a ese negocio.");
}

function validateTime(time: string | null | undefined): string | null {
  if (!time) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Hora inválida: ${time}. Formato esperado HH:MM.`);
  }
  return time;
}

/* ═══════════════════════════ Crear / actualizar turno ═══════════════════════════ */

export async function createScheduledShift(input: {
  userId: string;
  businessId: string;
  dateIso: string;           // "YYYY-MM-DD"
  startTime?: string | null;
  endTime?: string | null;
  role?: string | null;
  note?: string | null;
}) {
  const me = await assertManagerForBusiness(input.businessId);

  // Validar formato ISO antes de convertir
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)) {
    throw new Error(`Fecha inválida: ${input.dateIso}. Formato esperado YYYY-MM-DD.`);
  }

  // ↓↓↓ FIX: usar mediodía UTC para evitar drift de timezone
  const date = dateOnlyMx(input.dateIso);
  const start = validateTime(input.startTime);
  const end = validateTime(input.endTime);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true },
  });
  if (!user) throw new Error("Usuario no encontrado.");
  if (!user.isActive) throw new Error("Usuario inactivo.");

  const shift = await prisma.scheduledShift.upsert({
    where: {
      userId_businessId_date: {
        userId: input.userId,
        businessId: input.businessId,
        date,
      },
    },
    update: {
      startTime: start,
      endTime: end,
      role: input.role ?? null,
      note: input.note ?? null,
      status: "PLANNED",
    },
    create: {
      userId: input.userId,
      businessId: input.businessId,
      date,
      startTime: start,
      endTime: end,
      role: input.role ?? null,
      note: input.note ?? null,
      status: "PLANNED",
      createdById: (me as any).id,
    },
  });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");
  revalidatePath("/app/payroll");

  return { ok: true, shiftId: shift.id };
}

/* ═══════════════════════════ Editar turno ═══════════════════════════ */

export async function updateScheduledShift(input: {
  shiftId: string;
  startTime?: string | null;
  endTime?: string | null;
  role?: string | null;
  note?: string | null;
}) {
  const current = await prisma.scheduledShift.findUnique({
    where: { id: input.shiftId },
    select: { businessId: true },
  });
  if (!current) throw new Error("Turno no encontrado.");

  await assertManagerForBusiness(current.businessId);

  await prisma.scheduledShift.update({
    where: { id: input.shiftId },
    data: {
      startTime: input.startTime !== undefined ? validateTime(input.startTime) : undefined,
      endTime: input.endTime !== undefined ? validateTime(input.endTime) : undefined,
      role: input.role !== undefined ? input.role : undefined,
      note: input.note !== undefined ? input.note : undefined,
    },
  });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true };
}

/* ═══════════════════════════ Cancelar turno ═══════════════════════════ */

export async function cancelScheduledShift(shiftId: string) {
  const current = await prisma.scheduledShift.findUnique({
    where: { id: shiftId },
    select: { businessId: true, status: true },
  });
  if (!current) throw new Error("Turno no encontrado.");
  if (current.status === "CONFIRMED") {
    throw new Error("No se puede cancelar un turno ya confirmado (el empleado checó).");
  }

  await assertManagerForBusiness(current.businessId);

  await prisma.scheduledShift.update({
    where: { id: shiftId },
    data: { status: "CANCELED" },
  });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true };
}

/* ═══════════════════════════ Borrado definitivo ═══════════════════════════ */

export async function deleteScheduledShift(shiftId: string) {
  const current = await prisma.scheduledShift.findUnique({
    where: { id: shiftId },
    select: { businessId: true, status: true, date: true },
  });
  if (!current) throw new Error("Turno no encontrado.");

  // ↓↓↓ FIX: comparar contra hoy en México, no en UTC
  const todayDateMx = dateOnlyMx(todayMexicoIso());
  if (current.date < todayDateMx) {
    throw new Error("No se pueden eliminar turnos pasados. Usa cancelar en su lugar.");
  }
  if (current.status === "CONFIRMED") {
    throw new Error("No se puede eliminar un turno confirmado.");
  }

  await assertManagerForBusiness(current.businessId);

  await prisma.scheduledShift.delete({ where: { id: shiftId } });

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true };
}

/* ═══════════════════════════ Copiar semana ═══════════════════════════ */

export async function copyWeekShifts(input: {
  businessId: string;
  fromWeekMondayIso: string;
  toWeekMondayIso: string;
  overwrite?: boolean;
}) {
  const me = await assertManagerForBusiness(input.businessId);

  const fromStart = dateOnlyMx(input.fromWeekMondayIso);
  const fromEnd = new Date(fromStart);
  fromEnd.setUTCDate(fromEnd.getUTCDate() + 7);

  const fromShifts = await prisma.scheduledShift.findMany({
    where: {
      businessId: input.businessId,
      date: { gte: fromStart, lt: fromEnd },
      status: { not: "CANCELED" },
    },
  });

  if (fromShifts.length === 0) {
    return { ok: true, copied: 0, skipped: 0 };
  }

  const toStart = dateOnlyMx(input.toWeekMondayIso);
  let copied = 0;
  let skipped = 0;

  for (const s of fromShifts) {
    const daysDiff = Math.floor(
      (s.date.getTime() - fromStart.getTime()) / (24 * 3600 * 1000)
    );
    const newDate = new Date(toStart);
    newDate.setUTCDate(newDate.getUTCDate() + daysDiff);

    try {
      if (input.overwrite) {
        await prisma.scheduledShift.upsert({
          where: {
            userId_businessId_date: {
              userId: s.userId,
              businessId: s.businessId,
              date: newDate,
            },
          },
          update: {
            startTime: s.startTime,
            endTime: s.endTime,
            role: s.role,
            note: s.note,
            status: "PLANNED",
          },
          create: {
            userId: s.userId,
            businessId: s.businessId,
            date: newDate,
            startTime: s.startTime,
            endTime: s.endTime,
            role: s.role,
            note: s.note,
            status: "PLANNED",
            createdById: (me as any).id,
          },
        });
        copied++;
      } else {
        await prisma.scheduledShift.create({
          data: {
            userId: s.userId,
            businessId: s.businessId,
            date: newDate,
            startTime: s.startTime,
            endTime: s.endTime,
            role: s.role,
            note: s.note,
            status: "PLANNED",
            createdById: (me as any).id,
          },
        });
        copied++;
      }
    } catch {
      skipped++;
    }
  }

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true, copied, skipped };
}

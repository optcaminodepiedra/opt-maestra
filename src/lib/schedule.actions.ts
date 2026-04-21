"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { dateOnly, isoDate } from "@/lib/schedule";

/* ═══════════════════════════ Helpers ═══════════════════════════ */

async function assertManagerForBusiness(businessId: string) {
  const me = await getMe();
  if (!isManager({ role: me.role as string })) {
    throw new Error("Sin permisos para programar turnos.");
  }

  // MASTER_ADMIN, OWNER, SUPERIOR: acceso total
  if (["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(me.role as string)) {
    return me;
  }

  // Gerentes específicos: debe ser su primaryBusinessId
  // o tener acceso vía UserBusinessAccess (caso Claudia multi-negocio)
  if ((me as any).primaryBusinessId === businessId) return me;

  try {
    const access = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "UserBusinessAccess"
      WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
      LIMIT 1
    `;
    if (access.length > 0) return me;
  } catch {
    // UserBusinessAccess puede no existir aún
  }

  throw new Error("No tienes acceso a ese negocio.");
}

function validateTime(time: string | null | undefined): string | null {
  if (!time) return null;
  // Acepta HH:MM (00:00 a 23:59)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Hora inválida: ${time}. Formato esperado HH:MM.`);
  }
  return time;
}

/* ═══════════════════════════ Crear turno ═══════════════════════════ */

export async function createScheduledShift(input: {
  userId: string;
  businessId: string;
  dateIso: string;           // "YYYY-MM-DD"
  startTime?: string | null; // "07:00"
  endTime?: string | null;   // "15:00"
  role?: string | null;
  note?: string | null;
}) {
  const me = await assertManagerForBusiness(input.businessId);

  const date = dateOnly(input.dateIso);
  const start = validateTime(input.startTime);
  const end = validateTime(input.endTime);

  // Validar que el usuario exista y esté activo
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true },
  });
  if (!user) throw new Error("Usuario no encontrado.");
  if (!user.isActive) throw new Error("Usuario inactivo.");

  // Upsert: si ya existe un turno ese día, lo actualizamos
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

/* ═══════════════════════════ Borrado definitivo (solo PLANNED futuros) ═══════════════════════════ */

export async function deleteScheduledShift(shiftId: string) {
  const current = await prisma.scheduledShift.findUnique({
    where: { id: shiftId },
    select: { businessId: true, status: true, date: true },
  });
  if (!current) throw new Error("Turno no encontrado.");

  const today = dateOnly(isoDate());
  if (current.date < today) {
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

/* ═══════════════════════════ Copiar semana (power tool) ═══════════════════════════ */

/**
 * Copia todos los turnos de una semana a la siguiente.
 * Útil para cuando la plantilla es estable semana a semana.
 */
export async function copyWeekShifts(input: {
  businessId: string;
  fromWeekMondayIso: string;
  toWeekMondayIso: string;
  overwrite?: boolean;
}) {
  const me = await assertManagerForBusiness(input.businessId);

  const fromStart = dateOnly(input.fromWeekMondayIso);
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

  const toStart = dateOnly(input.toWeekMondayIso);
  let copied = 0;
  let skipped = 0;

  for (const s of fromShifts) {
    // Calcular la fecha equivalente en la nueva semana
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
      // Ya existía y no es overwrite
      skipped++;
    }
  }

  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true, copied, skipped };
}
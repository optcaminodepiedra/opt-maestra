"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const TZ = "America/Mexico_City";

// ═══════════════════════════════════════════════════════════════
// HELPERS DE FECHA — siempre en zona México
// ═══════════════════════════════════════════════════════════════

/**
 * Devuelve la fecha actual de México en formato YYYY-MM-DD.
 * Independiente de la zona horaria del servidor.
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

/**
 * Convierte YYYY-MM-DD a Date (medianoche UTC).
 * Para campos @db.Date donde Postgres solo guarda el día.
 */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Convierte un Date @db.Date a string YYYY-MM-DD.
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

// ═══════════════════════════════════════════════════════════════
// LECTURA: getPayrollRecords (admin/manager)
// ═══════════════════════════════════════════════════════════════

export async function getPayrollRecords() {
  const records = await prisma.workDay.findMany({
    orderBy: { date: "desc" },
    include: {
      user: { select: { fullName: true, email: true } },
      punches: { orderBy: { timestamp: "asc" } },
    },
  });

  return records.map((r) => ({
    ...r,
    date: dateToIso(r.date), // string YYYY-MM-DD, no Date
  }));
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: APROBAR / ELIMINAR
// ═══════════════════════════════════════════════════════════════

export async function approveWorkDay(id: string) {
  if (!id) throw new Error("Falta el ID del registro");
  await prisma.workDay.update({
    where: { id },
    data: { status: "APPROVED" },
  });
  revalidatePath("/app/payroll");
  return true;
}

export async function deleteWorkDay(id: string) {
  if (!id) throw new Error("Falta el ID del registro");
  await prisma.timePunch.deleteMany({ where: { workDayId: id } });
  await prisma.workDay.delete({ where: { id } });
  revalidatePath("/app/payroll");
  revalidatePath("/app/owner");
  return true;
}

export async function toggleUserClockIn(userId: string, requiresClockIn: boolean) {
  if (!userId) throw new Error("Falta el ID del usuario");
  await prisma.user.update({
    where: { id: userId },
    data: { requiresClockIn },
  });
  revalidatePath("/app/settings/users");
  return true;
}

// ═══════════════════════════════════════════════════════════════
// ESTADO DEL USUARIO: ¿tiene turno abierto? ¿última acción?
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica el estado de reloj checador del usuario:
 *  - hasOpenWorkDay: existe WorkDay del día con status OPEN
 *  - lastPunchType: tipo del último punch del día (o null si no hay)
 *  - nextActionType: lo que correspondería hacer ahora ("ENTRADA" o "SALIDA")
 *  - workDay: el registro del día si existe
 */
export async function getClockStatus(userId: string) {
  if (!userId) throw new Error("userId requerido");

  const todayIso = todayMexicoIso();
  const today = dateOnly(todayIso);

  const workDay = await prisma.workDay.findFirst({
    where: { userId, date: today },
    include: {
      punches: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });

  const hasOpenWorkDay = !!workDay && workDay.status === "OPEN";
  const lastPunchType = workDay?.punches[0]?.type ?? null;

  // Auto-determinar próximo tipo:
  //  - No hay punches → ENTRADA
  //  - Último fue ENTRADA → SALIDA
  //  - Último fue SALIDA → ENTRADA
  const nextActionType: "ENTRADA" | "SALIDA" =
    lastPunchType === "ENTRADA" ? "SALIDA" : "ENTRADA";

  return {
    hasOpenWorkDay,
    lastPunchType,
    nextActionType,
    workDayId: workDay?.id ?? null,
    todayIso,
  };
}

// ═══════════════════════════════════════════════════════════════
// CHECK-IN / CHECK-OUT con auto-determinar tipo
// ═══════════════════════════════════════════════════════════════

/**
 * Registra un punch (entrada o salida) auto-determinando el tipo
 * según el último punch del día.
 *
 * Reglas:
 *  - Si no existe WorkDay del día: crea WorkDay OPEN + TimePunch ENTRADA
 *  - Si existe WorkDay OPEN y último fue ENTRADA: agrega TimePunch SALIDA
 *  - Si existe WorkDay OPEN y último fue SALIDA: agrega TimePunch ENTRADA (volvió de descanso)
 *  - Si existe WorkDay cerrado del día: crea uno nuevo (caso raro pero posible)
 */
export async function forceClockIn(
  userId: string,
  gpsLat?: number,
  gpsLng?: number,
  photoUrl?: string,
  notes?: string
) {
  if (!userId) throw new Error("ID de usuario requerido");

  try {
    const todayIso = todayMexicoIso();
    const today = dateOnly(todayIso);

    // Buscar el WorkDay del día (cualquier status)
    const existingWorkDay = await prisma.workDay.findFirst({
      where: { userId, date: today },
      include: { punches: { orderBy: { timestamp: "desc" }, take: 1 } },
    });

    const lastPunchType = existingWorkDay?.punches[0]?.type ?? null;
    const nextType: "ENTRADA" | "SALIDA" =
      lastPunchType === "ENTRADA" ? "SALIDA" : "ENTRADA";

    const result = await prisma.$transaction(async (tx) => {
      let workDayId: string;

      if (existingWorkDay && existingWorkDay.status === "OPEN") {
        // Usar el WorkDay existente
        workDayId = existingWorkDay.id;
      } else {
        // Crear WorkDay nuevo (no existía o estaba cerrado/aprobado)
        const newWorkDay = await tx.workDay.create({
          data: {
            userId,
            date: today,
            status: "OPEN",
          },
        });
        workDayId = newWorkDay.id;
      }

      const punch = await tx.timePunch.create({
        data: {
          workDayId,
          type: nextType,
          deviceType: "MOBILE",
          gpsLat: gpsLat ?? null,
          gpsLng: gpsLng ?? null,
          photoUrl: photoUrl ?? null,
          note: notes || null,
        },
      });

      return { punch, type: nextType, workDayId };
    });

    revalidatePath("/", "layout");
    return { success: true, type: result.type, data: result.punch };
  } catch (error: any) {
    console.error("PRISMA ERROR:", error);
    throw new Error(error.message || "Error al guardar en base de datos");
  }
}

/**
 * Cierra el turno activo del usuario.
 * Cambia el status del WorkDay de OPEN a NEEDS_REVIEW.
 * Se llama después de hacer la SALIDA final del día.
 */
export async function closeWorkDay(userId: string) {
  const todayIso = todayMexicoIso();
  const today = dateOnly(todayIso);

  const workDay = await prisma.workDay.findFirst({
    where: { userId, date: today, status: "OPEN" },
  });

  if (!workDay) return { success: false, reason: "No hay turno abierto" };

  await prisma.workDay.update({
    where: { id: workDay.id },
    data: { status: "NEEDS_REVIEW" },
  });

  revalidatePath("/app/payroll");
  revalidatePath("/", "layout");
  return { success: true };
}

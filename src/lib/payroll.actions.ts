"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const TZ = "America/Mexico_City";

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
 * Para usar con campos @db.Date donde Postgres solo guarda el día.
 */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Convierte un Date @db.Date a string YYYY-MM-DD.
 * Usa UTC getters para evitar mal-conversión por zona horaria.
 */
function dateToIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ==============================
// ✅ LECTURA DE NÓMINA
// ==============================
export async function getPayrollRecords() {
  const records = await prisma.workDay.findMany({
    orderBy: { date: "desc" },
    include: {
      user: {
        select: { fullName: true, email: true },
      },
      punches: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  // ↓↓↓ FIX: convertir date a string YYYY-MM-DD ANTES de mandar al cliente
  // Así el cliente nunca interpreta el Date con su zona horaria
  return records.map((r) => ({
    ...r,
    date: dateToIso(r.date), // string "2026-05-11" en lugar de Date
    // punches.timestamp se queda como Date — esos sí tienen hora real
  }));
}

// ==============================
// ✅ ACCIONES DE ADMINISTRADOR
// ==============================
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
  await prisma.timePunch.deleteMany({
    where: { workDayId: id },
  });
  await prisma.workDay.delete({
    where: { id },
  });
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

// ==============================
// ✅ ACCIÓN DE CHECADO (CON FOTO)
// ==============================
export async function forceClockIn(
  userId: string,
  gpsLat?: number,
  gpsLng?: number,
  photoUrl?: string,
  notes?: string
) {
  if (!userId) throw new Error("ID de usuario requerido");

  try {
    // ↓↓↓ FIX: usar fecha de MÉXICO, no la del servidor
    const todayIso = todayMexicoIso(); // "2026-05-11" en México
    const today = dateOnly(todayIso);   // Date(2026-05-11T00:00:00Z)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar si ya existe un WorkDay abierto del día (en México)
      // Para evitar duplicar el WorkDay si el usuario hace varios check-ins
      let workDay = await tx.workDay.findFirst({
        where: {
          userId,
          date: today,
          status: "OPEN",
        },
      });

      if (!workDay) {
        // Crear el día de trabajo
        workDay = await tx.workDay.create({
          data: {
            userId,
            date: today,
            status: "OPEN",
          },
        });
      }

      // 2. Crear la checada vinculada
      return await tx.timePunch.create({
        data: {
          workDayId: workDay.id,
          type: "ENTRADA",
          deviceType: "MOBILE",
          gpsLat: gpsLat ?? null,
          gpsLng: gpsLng ?? null,
          photoUrl: photoUrl ?? null,
          note: notes || null,
        },
      });
    });

    revalidatePath("/", "layout");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("PRISMA ERROR:", error);
    throw new Error(error.message || "Error al guardar en base de datos");
  }
}

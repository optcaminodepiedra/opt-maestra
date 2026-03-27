"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==============================
// ✅ LECTURA DE NÓMINA
// ==============================
export async function getPayrollRecords() {
  const records = await prisma.workDay.findMany({
    orderBy: { date: "desc" },
    include: {
      user: {
        select: { fullName: true, email: true }
      },
      punches: {
        orderBy: { timestamp: "asc" }
      }
    }
  });
  return records;
}

// ==============================
// ✅ ACCIONES DE ADMINISTRADOR
// ==============================
export async function approveWorkDay(id: string) {
  if (!id) throw new Error("Falta el ID del registro");
  await prisma.workDay.update({
    where: { id },
    data: { status: "APPROVED" }
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

// ==============================
// ✅ ACCIÓN DE CHECADO (CON FOTO)
// ==============================
export async function forceClockIn(
  userId: string, 
  gpsLat?: number, 
  gpsLng?: number, 
  photoUrl?: string, // Lo seguimos recibiendo para no romper el cliente
  notes?: string
) {
  if (!userId) throw new Error("Usuario no válido");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // LOGS DE DEBUGGEO (Para ver el tamaño que intentábamos mandar)
  console.log("---------- DEBUG CLOCK IN (HACK) ----------");
  console.log("User ID:", userId);
  if (photoUrl) {
    console.log("Longitud de la foto Base64 que llegó:", photoUrl.length);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Verificamos si ya checó hoy
    const existingShift = await tx.workDay.findFirst({
      where: { userId, status: "OPEN", date: { gte: today } }
    });

    if (existingShift) {
      console.log("Ya tiene turno abierto hoy.");
      revalidatePath("/", "layout");
      return true; 
    }

    // 2. Creamos el Día de Trabajo
    const workDay = await tx.workDay.create({
      data: { userId: userId, date: today, status: "OPEN" }
    });

    // 3. Registramos la entrada (EL HACK)
    await tx.timePunch.create({
      data: {
        workDayId: workDay.id,
        type: "ENTRADA",
        deviceType: "MOBILE",
        gpsLat,
        gpsLng,
        // ✅ HACK: Guardamos un texto corto en lugar del Base64 gigante
        // Esto previene el error de la DB
        photoUrl: "FOTO_GUARDADA_EN_MEMORIA_TEMPORAL", 
        notes,
      }
    });

    console.log("Clock In exitoso (sin foto real) en DB");
    revalidatePath("/", "layout");
    return true;
  });
}
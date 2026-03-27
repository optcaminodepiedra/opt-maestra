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
  photoUrl?: string,
  notes?: string
) {
  if (!userId) throw new Error("Usuario no válido");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // LOGS DE DEBUGGEO EN EL SERVIDOR (Ver en Vercel Logs)
  console.log("---------- DEBUG CLOCK IN ----------");
  console.log("User ID:", userId);
  console.log("GPS:", gpsLat, gpsLng);
  console.log("Notes:", notes);
  
  if (photoUrl) {
    console.log("Longitud de la foto Base64:", photoUrl.length);
    // Vemos los primeros 50 caracteres para asegurar que es un Base64 válido
    console.log("Inicio de la foto:", photoUrl.substring(0, 50));
  } else {
    console.log("¡CUIDADO! No llegó foto Url");
  }

  // PRUEBA DE FUEGO: Usamos una transacción para asegurar integridad
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Verificamos si ya checó hoy (para evitar duplicados por error de red)
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

      // 3. Registramos la entrada
      // TEMPORAL: Si sospechamos de la DB, podemos poner 'photoUrl: "dummy_photo"' para probar
      await tx.timePunch.create({
        data: {
          workDayId: workDay.id,
          type: "ENTRADA",
          deviceType: "MOBILE",
          gpsLat,
          gpsLng,
          photoUrl, // Intentamos el real primero
          notes,
        }
      });

      console.log("Clock In exitoso en DB");
      revalidatePath("/", "layout");
      return true;
    });
  } catch (error: any) {
    console.error("ERROR CRÍTICO EN CLOCK IN:", error);
    // Si truena la DB, lanzamos el error exacto para que el cliente lo cacho
    throw new Error(`Error en base de datos: ${error.message}`);
  }
}
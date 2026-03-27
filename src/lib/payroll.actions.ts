"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function forceClockIn(
  userId: string, 
  gpsLat?: number, 
  gpsLng?: number, 
  photoUrl?: string,
  notes?: string
) {
  if (!userId) throw new Error("ID de usuario requerido");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Usamos una transacción para que sea atómico
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el día de trabajo
      const workDay = await tx.workDay.create({
        data: {
          userId,
          date: today,
          status: "OPEN",
        }
      });

      // 2. Crear la checada vinculada
      return await tx.timePunch.create({
        data: {
          workDayId: workDay.id,
          type: "ENTRADA",
          deviceType: "MOBILE",
          gpsLat: gpsLat || null,
          gpsLng: gpsLng || null,
          photoUrl: photoUrl || null,
          notes: notes || null,
        }
      });
    });

    revalidatePath("/", "layout");
    return { success: true, data: result };
  } catch (error: any) {
    console.error("PRISMA ERROR:", error);
    throw new Error(error.message || "Error al guardar en base de datos");
  }
}
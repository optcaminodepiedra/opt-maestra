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
  await prisma.timePunch.deleteMany({
    where: { workDayId: id }
  });
  await prisma.workDay.delete({
    where: { id }
  });
  revalidatePath("/app/payroll");
  revalidatePath("/app/owner");
  return true;
}

export async function toggleUserClockIn(userId: string, requiresClockIn: boolean) {
  if (!userId) throw new Error("Falta el ID del usuario");
  await prisma.user.update({
    where: { id: userId },
    data: { requiresClockIn }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          note: notes || null, // Mapeamos 'notes' del cliente a 'note' de la DB
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
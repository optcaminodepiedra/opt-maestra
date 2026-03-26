"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
// ==============================
// ✅ LECTURA DE NÓMINA
// ==============================
export async function getPayrollRecords() {
  // Buscamos todos los días de trabajo, ordenados del más reciente al más antiguo
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

  export async function forceClockIn(userId: string, gpsLat?: number, gpsLng?: number, photoUrl?: string) {
  if (!userId) throw new Error("Usuario no válido");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Creamos el Día de Trabajo
  const workDay = await prisma.workDay.create({
    data: {
      userId: userId,
      date: today,
      status: "OPEN",
    }
  });

  // 2. Registramos la entrada con la FOTO y el GPS
  await prisma.timePunch.create({
    data: {
      workDayId: workDay.id,
      type: "ENTRADA",
      deviceType: "MOBILE",
      gpsLat,
      gpsLng,
      photoUrl, // <--- Guardamos el Base64 de la cámara
    }
  });

  revalidatePath("/", "layout");
  return true;
}

export async function toggleUserClockIn(userId: string, requiresClockIn: boolean) {
  if (!userId) throw new Error("Falta el ID del usuario");

  await prisma.user.update({
    where: { id: userId },
    data: { requiresClockIn }
  });

  // Refresca la vista donde tengas tu tabla de usuarios
  revalidatePath("/app/settings/users"); 
  return true;
}
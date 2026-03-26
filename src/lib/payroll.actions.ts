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

  // 1. Borramos las checadas usando el nombre real: timePunch
  await prisma.timePunch.deleteMany({
    where: { workDayId: id }
  });

  // 2. Ahora sí, borramos el día de trabajo vacío
  await prisma.workDay.delete({
    where: { id }
  });

  // 3. Refrescamos las pantallas
  revalidatePath("/app/payroll");
  revalidatePath("/app/owner");
  return true;
}

// Agrégalo al final del archivo
export async function forceClockIn(userId: string, gpsLat?: number, gpsLng?: number) {
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

  // 2. Le registramos su primera checada (ENTRADA)
  await prisma.timePunch.create({
    data: {
      workDayId: workDay.id,
      type: "ENTRADA",
      deviceType: "MOBILE", // Asumimos que es desde su dispositivo personal
      gpsLat,
      gpsLng
    }
  });

  // Refrescamos todo el layout para que el sistema ya le de acceso
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
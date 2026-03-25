"use server";

import { prisma } from "@/lib/prisma";

export async function getPayrollRecords() {
  // Traemos los últimos 50 días de trabajo registrados, ordenados del más reciente al más antiguo
  const workDays = await prisma.workDay.findMany({
    orderBy: { date: "desc" },
    take: 50,
    include: {
      user: {
        select: { fullName: true, email: true }
      },
      punches: {
        orderBy: { timestamp: "asc" } // Ordenamos las checadas por hora
      }
    }
  });

  return workDays;

  export async function approveWorkDay(id: string) {
  if (!id) throw new Error("Falta el ID del registro");

  await prisma.workDay.update({
    where: { id },
    data: { status: "APPROVED" }
  });

  // Refresca la página en automático
  revalidatePath("/app/payroll");
  return true;
}

export async function deleteWorkDay(id: string) {
  if (!id) throw new Error("Falta el ID del registro");

  // Primero borramos todas las checadas (fotos, mapas) asociadas a este día
  // (Asumiendo que tu modelo se llama "Punch" o similar. Si tienes configurado "onDelete: Cascade" en tu schema, esto no es estrictamente necesario, pero es más seguro).
  try {
    await prisma.punch.deleteMany({
      where: { workDayId: id }
    });
  } catch (e) {
    // Si tu modelo no se llama Punch o ya tiene cascade, ignoramos el error aquí
  }

  // Luego borramos el día de trabajo completo
  await prisma.workDay.delete({
    where: { id }
  });

  revalidatePath("/app/payroll");
  revalidatePath("/app/owner"); // Refrescamos el dashboard también
  return true;
}
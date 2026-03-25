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
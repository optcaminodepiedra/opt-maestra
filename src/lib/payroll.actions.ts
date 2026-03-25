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

  // Intentamos borrar las fotos/ubicaciones (checadas) asociadas a este día primero
  try {
    await prisma.punch.deleteMany({
      where: { workDayId: id }
    });
  } catch (e) {
    // Si tu base de datos ya borra en cascada automáticamente, ignoramos este paso
  }

  // Finalmente borramos el registro del día
  await prisma.workDay.delete({
    where: { id }
  });

  // Refrescamos tanto la tabla de nómina como el dashboard ejecutivo
  revalidatePath("/app/payroll");
  revalidatePath("/app/owner");
  return true;
}
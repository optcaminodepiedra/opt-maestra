"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPayrollRecords() {
  // ... (código que ya tenías)
  
  return workDays;
} // <--- ESTA ES LA LLAVE QUE CIERRA LA FUNCIÓN ANTERIOR


// ==============================
// ✅ ACCIONES DE ADMINISTRADOR (AQUÍ AFUERA VAN LAS NUEVAS)
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

  try {
    await prisma.punch.deleteMany({
      where: { workDayId: id }
    });
  } catch (e) {}

  await prisma.workDay.delete({
    where: { id }
  });

  revalidatePath("/app/payroll");
  revalidatePath("/app/owner");
  return true;
}
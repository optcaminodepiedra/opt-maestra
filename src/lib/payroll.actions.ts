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
}
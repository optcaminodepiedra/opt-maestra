"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function togglePeriodLock(year: number, month: number, isClosed: boolean, userName: string) {
  // Upsert busca si ya existe el registro de ese mes. Si existe lo actualiza, si no, lo crea.
  await prisma.accountingPeriod.upsert({
    where: {
      year_month: { year, month }
    },
    update: {
      isClosed,
      closedAt: isClosed ? new Date() : null,
      closedByRef: isClosed ? userName : null,
    },
    create: {
      year,
      month,
      isClosed,
      closedAt: isClosed ? new Date() : null,
      closedByRef: isClosed ? userName : null,
    }
  });

  revalidatePath("/app/accounting");
  revalidatePath("/app/accounting/periods");
  return true;
}
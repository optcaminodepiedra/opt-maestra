"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export async function updateMyProfile(input: {
  fullName?: string;
  jobTitle?: string;
  department?: string;
}) {
  const me = await getMe();
  await prisma.user.update({
    where: { id: (me as any).id },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName.trim() }),
      ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle?.trim() || null }),
      ...(input.department !== undefined && { department: input.department?.trim() || null }),
    },
  });
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function getSystemStats() {
  const me = await getMe();
  if (!ADMIN_ROLES.includes(me.role as string)) return null;

  const [users, businesses, cashpoints, sales, expenses] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.business.count(),
    prisma.cashpoint.count(),
    prisma.sale.count(),
    prisma.expense.count(),
  ]);

  return { users, businesses, cashpoints, sales, expenses };
}
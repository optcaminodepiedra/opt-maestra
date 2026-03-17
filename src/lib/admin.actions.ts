"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { getMe } from "@/lib/session";

function rv() {
  revalidatePath("/app/owner/users");
  revalidatePath("/app/owner/settings");
}

async function requirePerm(perm: Parameters<typeof hasPermission>[1]) {
  const me = await getMe();
  if (!hasPermission(me.role, perm)) throw new Error("Sin permiso");
  return me;
}

function roleIsHigh(r?: string) {
  return r === "OWNER" || r === "MASTER_ADMIN";
}

export async function getAdminBoot() {
  await requirePerm("ADMIN_USERS_VIEW");

  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });
  const cashpoints = await prisma.cashpoint.findMany({
    orderBy: [{ businessId: "asc" }, { name: "asc" }],
  });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
      primaryBusinessId: true,
      businessId: true,
    },
  });

  return { businesses, cashpoints, users };
}

/** =======================
 * USERS
 * ======================= */
export async function adminUpdateUser(input: {
  userId: string;
  role?: string;
  primaryBusinessId?: string | null;
  fullName?: string;
  username?: string;
  isActive?: boolean;
}) {
  const me = await requirePerm("ADMIN_USERS_EDIT");

  if (!input.userId) throw new Error("Falta userId");

  // No toques tu propio rol por accidente (opcional; si quieres permitirlo, quita esto)
  if (input.userId === me.id && input.role && input.role !== me.role) {
    throw new Error("No puedes cambiar tu propio rol.");
  }

  // Solo MASTER_ADMIN puede asignar OWNER o MASTER_ADMIN
  if (input.role && roleIsHigh(input.role) && me.role !== "MASTER_ADMIN") {
    throw new Error("Solo MASTER_ADMIN puede asignar OWNER/MASTER_ADMIN.");
  }

  const data: any = {};

  if (typeof input.role === "string") data.role = input.role;
  if (input.primaryBusinessId !== undefined) data.primaryBusinessId = input.primaryBusinessId;
  if (typeof input.fullName === "string") data.fullName = input.fullName.trim();
  if (typeof input.username === "string") data.username = input.username.trim().toLowerCase();
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;

  await prisma.user.update({
    where: { id: input.userId },
    data,
  });

  rv();
  return true;
}

/**
 * ✅ Recomendado: desactivar usuario (en vez de borrar)
 */
export async function adminDeactivateUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_EDIT");
  if (!userId) throw new Error("Falta userId");
  if (userId === me.id) throw new Error("No puedes desactivarte tú mismo.");

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  rv();
  return true;
}

/**
 * ⚠️ Borrado definitivo (solo si de verdad lo quieres)
 */
export async function adminDeleteUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_DELETE");
  if (!userId) throw new Error("Falta userId");
  if (userId === me.id) throw new Error("No puedes eliminarte tú mismo.");

  // opcional: evita borrar el último MASTER_ADMIN
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role === "MASTER_ADMIN") {
    const count = await prisma.user.count({ where: { role: "MASTER_ADMIN", isActive: true } });
    if (count <= 1) throw new Error("No puedes borrar el último MASTER_ADMIN activo.");
  }

  await prisma.user.delete({ where: { id: userId } });
  rv();
  return true;
}
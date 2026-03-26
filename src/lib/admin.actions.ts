"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { getMe } from "@/lib/session";
import bcrypt from "bcryptjs";

// Función auxiliar para refrescar las rutas después de un cambio
function rv() {
  revalidatePath("/app/owner/users");
  revalidatePath("/app/owner/settings");
}

// Validación de permisos
async function requirePerm(perm: Parameters<typeof hasPermission>[1]) {
  const me = await getMe();
  if (!hasPermission(me.role, perm)) throw new Error("Sin permiso");
  return me;
}

function roleIsHigh(r?: string) {
  return r === "OWNER" || r === "MASTER_ADMIN";
}

// ==========================================
// ✅ ESTA ES LA FUNCIÓN QUE TE FALTABA
// ==========================================
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
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      primaryBusinessId: true,
      businessId: true,
      requiresClockIn: true, // 🚨 IMPORTANTE: Esto habilita el switch en la UI
    },
  });

  return { businesses, cashpoints, users };
}

// ==========================================
// CREAR USUARIO
// ==========================================
export async function adminCreateUser(input: {
  fullName: string;
  username: string;
  email?: string;
  role: string;
  primaryBusinessId?: string | null;
}) {
  const me = await requirePerm("ADMIN_USERS_EDIT");

  if (!input.fullName || !input.username || !input.role) {
    throw new Error("Faltan datos obligatorios (Nombre, Username, Rol).");
  }

  const existingUser = await prisma.user.findUnique({ 
    where: { username: input.username.trim().toLowerCase() } 
  });
  
  if (existingUser) throw new Error("El username ya está en uso.");

  const hashedPassword = await bcrypt.hash("123456", 10);

  await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      username: input.username.trim().toLowerCase(),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      primaryBusinessId: input.primaryBusinessId,
      passwordHash: hashedPassword,
      isActive: true,
      requiresClockIn: false, // Por defecto no es obligatorio
    },
  });

  rv();
  return true;
}

// ==========================================
// ACTUALIZAR USUARIO (INCLUYE EL SWITCH)
// ==========================================
export async function adminUpdateUser(input: {
  userId: string;
  role?: string;
  primaryBusinessId?: string | null;
  fullName?: string;
  username?: string;
  email?: string;
  isActive?: boolean;
  requiresClockIn?: boolean; // 🚨 NUEVO CAMPO
}) {
  const me = await requirePerm("ADMIN_USERS_EDIT");

  if (!input.userId) throw new Error("Falta userId");

  const data: any = {};

  if (typeof input.role === "string") data.role = input.role;
  if (input.primaryBusinessId !== undefined) data.primaryBusinessId = input.primaryBusinessId;
  if (typeof input.fullName === "string") data.fullName = input.fullName.trim();
  if (typeof input.username === "string") data.username = input.username.trim().toLowerCase();
  if (typeof input.email === "string") data.email = input.email.trim().toLowerCase();
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  if (typeof input.requiresClockIn === "boolean") data.requiresClockIn = input.requiresClockIn; // 🚨 GUARDADO

  await prisma.user.update({
    where: { id: input.userId },
    data,
  });

  rv();
  return true;
}

// ==========================================
// DESACTIVAR Y ELIMINAR
// ==========================================
export async function adminDeactivateUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_EDIT");
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  rv();
  return true;
}

export async function adminDeleteUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_DELETE");
  await prisma.user.delete({ where: { id: userId } });
  rv();
  return true;
}
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { getMe } from "@/lib/session";
import bcrypt from "bcryptjs";

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
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      primaryBusinessId: true,
      businessId: true,
    },
  });

  return { businesses, cashpoints, users };
}

// ==========================================
// NUEVO: CREAR USUARIO
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

  if (roleIsHigh(input.role) && me.role !== "MASTER_ADMIN") {
    throw new Error("Solo MASTER_ADMIN puede crear usuarios de nivel OWNER.");
  }

  // Verificar que el username no exista
  const existingUser = await prisma.user.findUnique({ 
    where: { username: input.username.trim().toLowerCase() } 
  });
  
  if (existingUser) throw new Error("Ese nombre de usuario (username) ya está en uso.");

  // Verificar que el correo no exista
  if (input.email) {
    const existingEmail = await prisma.user.findUnique({ 
      where: { email: input.email.trim().toLowerCase() } 
    });
    if (existingEmail) throw new Error("Ese correo electrónico ya está registrado.");
  }

  // 🔐 ENCRIPTAMOS LA CONTRASEÑA POR DEFECTO
  const hashedPassword = await bcrypt.hash("123456", 10);

  // Crear en la base de datos
  await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      username: input.username.trim().toLowerCase(),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      primaryBusinessId: input.primaryBusinessId,
      passwordHash: hashedPassword, // <--- AQUÍ ESTÁ LA SOLUCIÓN
      isActive: true,
    },
  });

  rv();
  return true;
}

// ==========================================
// ACTUALIZAR USUARIO
// ==========================================
export async function adminUpdateUser(input: {
  userId: string;
  role?: string;
  primaryBusinessId?: string | null;
  fullName?: string;
  username?: string;
  email?: string;
  isActive?: boolean;
}) {
  const me = await requirePerm("ADMIN_USERS_EDIT");

  if (!input.userId) throw new Error("Falta userId");

  if (input.userId === me.id && input.role && input.role !== me.role) {
    throw new Error("No puedes cambiar tu propio rol.");
  }

  if (input.role && roleIsHigh(input.role) && me.role !== "MASTER_ADMIN") {
    throw new Error("Solo MASTER_ADMIN puede asignar OWNER/MASTER_ADMIN.");
  }

  const data: any = {};

  if (typeof input.role === "string") data.role = input.role;
  if (input.primaryBusinessId !== undefined) data.primaryBusinessId = input.primaryBusinessId;
  if (typeof input.fullName === "string") data.fullName = input.fullName.trim();
  if (typeof input.username === "string") data.username = input.username.trim().toLowerCase();
  if (typeof input.email === "string") data.email = input.email.trim().toLowerCase();
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;

  await prisma.user.update({
    where: { id: input.userId },
    data,
  });

  rv();
  return true;
}

export async function adminDeactivateUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_EDIT");
  if (!userId) throw new Error("Falta userId");
  if (userId === me.id) throw new Error("No puedes desactivarte tú mismo.");

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  rv();
  return true;
}

export async function adminDeleteUser(userId: string) {
  const me = await requirePerm("ADMIN_USERS_DELETE");
  if (!userId) throw new Error("Falta userId");
  if (userId === me.id) throw new Error("No puedes eliminarte tú mismo.");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (target?.role === "MASTER_ADMIN") {
    const count = await prisma.user.count({ where: { role: "MASTER_ADMIN", isActive: true } });
    if (count <= 1) throw new Error("No puedes borrar el último MASTER_ADMIN activo.");
  }

  await prisma.user.delete({ where: { id: userId } });
  rv();
  return true;
}
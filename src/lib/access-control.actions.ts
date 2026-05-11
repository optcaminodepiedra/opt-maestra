"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

async function assertAdmin() {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    throw new Error("Solo administradores pueden gestionar accesos.");
  }
  return me;
}

/**
 * Lista todos los usuarios con sus accesos.
 */
export async function listUsersWithAccess() {
  await assertAdmin();

  const [users, businesses] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        primaryBusinessId: true,
        jobTitle: true,
        businessAccess: {
          select: {
            businessId: true,
            business: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const enriched = users.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    jobTitle: u.jobTitle,
    primaryBusinessId: u.primaryBusinessId,
    accessIds: u.businessAccess.map((a) => a.businessId),
    accessNames: u.businessAccess.map((a) => a.business?.name ?? "?"),
  }));

  return { users: enriched, businesses };
}

/**
 * Agrega un acceso de usuario a un negocio.
 */
export async function grantBusinessAccess(input: { userId: string; businessId: string }) {
  await assertAdmin();

  // Verificar duplicado
  const existing = await prisma.userBusinessAccess.findFirst({
    where: { userId: input.userId, businessId: input.businessId },
  });
  if (existing) {
    return { ok: true, alreadyExists: true };
  }

  await prisma.userBusinessAccess.create({
    data: {
      userId: input.userId,
      businessId: input.businessId,
    },
  });

  revalidatePath("/app/admin/access-control");
  return { ok: true, alreadyExists: false };
}

/**
 * Quita un acceso de usuario a un negocio.
 */
export async function revokeBusinessAccess(input: { userId: string; businessId: string }) {
  await assertAdmin();

  await prisma.userBusinessAccess.deleteMany({
    where: { userId: input.userId, businessId: input.businessId },
  });

  revalidatePath("/app/admin/access-control");
  return { ok: true };
}

/**
 * Cambia el primaryBusinessId del usuario.
 */
export async function setPrimaryBusiness(input: { userId: string; businessId: string | null }) {
  await assertAdmin();

  await prisma.user.update({
    where: { id: input.userId },
    data: { primaryBusinessId: input.businessId },
  });

  revalidatePath("/app/admin/access-control");
  return { ok: true };
}

/**
 * Crea un nuevo usuario mesero/staff con acceso a negocios.
 */
export async function createStaffUser(input: {
  fullName: string;
  username: string;
  password: string;
  role: string;
  email?: string;
  jobTitle?: string;
  primaryBusinessId?: string;
  accessBusinessIds?: string[];
}) {
  await assertAdmin();

  // Validaciones
  if (!input.fullName.trim()) throw new Error("Nombre completo requerido");
  if (!input.username.trim()) throw new Error("Username requerido");
  if (!input.password || input.password.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }
  if (!input.role) throw new Error("Rol requerido");

  // Verificar username único
  const existing = await prisma.user.findUnique({
    where: { username: input.username.trim().toLowerCase() },
  });
  if (existing) throw new Error(`Ya existe un usuario con username "${input.username}"`);

  // Verificar fullName único
  const existingName = await prisma.user.findUnique({
    where: { fullName: input.fullName.trim() },
  });
  if (existingName) throw new Error(`Ya existe un usuario con nombre "${input.fullName}"`);

  // Hash password
  const hash = await bcrypt.hash(input.password, 10);

  // Crear usuario + accesos en transacción
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName.trim(),
      username: input.username.trim().toLowerCase(),
      passwordHash: hash,
      role: input.role,
      email: input.email?.trim() || null,
      jobTitle: input.jobTitle?.trim() || null,
      primaryBusinessId: input.primaryBusinessId || null,
      isActive: true,
    },
  });

  // Crear accesos
  if (input.accessBusinessIds && input.accessBusinessIds.length > 0) {
    await prisma.userBusinessAccess.createMany({
      data: input.accessBusinessIds.map((bid) => ({
        userId: user.id,
        businessId: bid,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/app/admin/access-control");
  return { ok: true, userId: user.id };
}

/**
 * Desactiva un usuario (no lo borra para conservar histórico).
 */
export async function deactivateUser(userId: string) {
  await assertAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
  revalidatePath("/app/admin/access-control");
  return { ok: true };
}

/**
 * Resetea contraseña de un usuario.
 */
export async function resetUserPassword(input: { userId: string; newPassword: string }) {
  await assertAdmin();

  if (!input.newPassword || input.newPassword.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }

  const hash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: hash },
  });

  return { ok: true };
}

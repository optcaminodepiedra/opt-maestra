"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const MANAGE_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH",
];

async function assertCanManage(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!MANAGE_ROLES.includes(role)) throw new Error("Sin permisos");
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("Sin acceso al negocio");
  return me;
}

/**
 * Listar impresoras de un negocio.
 */
export async function listPrintersForBusiness(businessId: string) {
  await assertCanManage(businessId);

  return prisma.printer.findMany({
    where: { businessId },
    orderBy: { role: "asc" },
  });
}

/**
 * Crear impresora nueva.
 */
export async function createPrinter(input: {
  businessId: string;
  name: string;
  role: "KITCHEN" | "BAR" | "CASHIER" | "OTHER";
  ipAddress: string;
  port?: number;
  paperWidth?: number;
}) {
  await assertCanManage(input.businessId);

  if (!input.name.trim()) throw new Error("Nombre requerido");
  if (!input.ipAddress.trim()) throw new Error("IP requerida");

  // Validar formato IP (básico)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(input.ipAddress.trim())) {
    throw new Error("Formato de IP inválido (ej: 192.168.1.100)");
  }

  const printer = await prisma.printer.create({
    data: {
      businessId: input.businessId,
      name: input.name.trim(),
      role: input.role,
      ipAddress: input.ipAddress.trim(),
      port: input.port ?? 9100,
      paperWidth: input.paperWidth ?? 48,
      isActive: true,
    },
  });

  revalidatePath("/app/admin/printers");
  return { ok: true, id: printer.id };
}

/**
 * Actualizar impresora.
 */
export async function updatePrinter(input: {
  id: string;
  name?: string;
  role?: "KITCHEN" | "BAR" | "CASHIER" | "OTHER";
  ipAddress?: string;
  port?: number;
  isActive?: boolean;
}) {
  const printer = await prisma.printer.findUnique({
    where: { id: input.id },
    select: { businessId: true },
  });
  if (!printer) throw new Error("Impresora no encontrada");

  await assertCanManage(printer.businessId);

  if (input.ipAddress) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(input.ipAddress.trim())) {
      throw new Error("Formato de IP inválido");
    }
  }

  await prisma.printer.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress.trim() } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  revalidatePath("/app/admin/printers");
  return { ok: true };
}

/**
 * Eliminar impresora.
 */
export async function deletePrinter(id: string) {
  const printer = await prisma.printer.findUnique({
    where: { id },
    select: { businessId: true },
  });
  if (!printer) throw new Error("Impresora no encontrada");

  await assertCanManage(printer.businessId);

  await prisma.printer.delete({ where: { id } });

  revalidatePath("/app/admin/printers");
  return { ok: true };
}

/**
 * Obtener token del Print Agent + estado.
 */
export async function getPrintAgentInfo(businessId: string) {
  await assertCanManage(businessId);

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      printAgentToken: true as any,
    } as any,
  });

  const pendingJobs = await prisma.printJob.count({
    where: { businessId, status: "PENDING" },
  });

  const failedJobs = await prisma.printJob.count({
    where: { businessId, status: "FAILED" },
  });

  return {
    businessName: business?.name ?? "?",
    token: (business as any)?.printAgentToken ?? null,
    pendingJobs,
    failedJobs,
  };
}

/**
 * Regenerar token del Print Agent (en caso de seguridad).
 */
export async function regeneratePrintAgentToken(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    throw new Error("Solo administradores pueden regenerar tokens");
  }

  const newToken = "cdp_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  await prisma.business.update({
    where: { id: businessId },
    data: { printAgentToken: newToken } as any,
  });

  revalidatePath("/app/admin/printers");
  return { ok: true, newToken };
}

/**
 * Crear un PrintJob de prueba para verificar que la impresora funciona.
 */
export async function testPrinter(printerId: string) {
  const printer = await prisma.printer.findUnique({
    where: { id: printerId },
    include: { business: { select: { name: true } } },
  });
  if (!printer) throw new Error("Impresora no encontrada");

  await assertCanManage(printer.businessId);

  // Import dinámico para evitar problemas SSR
  const { ESCPOSBuilder } = await import("@/lib/escpos");

  const b = new ESCPOSBuilder();
  b.alignCenter()
    .bold(true).sizeDouble().line("PRUEBA DE IMPRESIÓN").sizeNormal().bold(false)
    .line(printer.business.name).feed(1)
    .alignLeft()
    .line(`Impresora: ${printer.name}`)
    .line(`Rol: ${printer.role}`)
    .line(`IP: ${printer.ipAddress}:${printer.port}`)
    .line(`Fecha: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`)
    .feed(1)
    .alignCenter().line("Si ves este ticket, la impresora")
    .line("está configurada correctamente ✓").feed(2)
    .cut(true);

  await prisma.printJob.create({
    data: {
      businessId: printer.businessId,
      printerId: printer.id,
      type: "OTHER",
      status: "PENDING",
      payload: { test: true, printerId } as any,
      rawBytes: b.toBase64(),
    },
  });

  revalidatePath("/app/admin/printers");
  return { ok: true };
}

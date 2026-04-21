"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";

/* ═══════════════════════════ Helpers ═══════════════════════════ */

async function assertManagerForBusiness(businessId: string) {
  const me = await getMe();
  const role = me.role as string;

  if (["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(role)) return me;

  // Rol INVENTORY también puede crear requisiciones para cualquier negocio
  if (role === "INVENTORY") return me;

  if (!isManager({ role })) {
    throw new Error("Sin permisos para crear requisiciones.");
  }

  if ((me as any).primaryBusinessId === businessId) return me;

  try {
    const access = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "UserBusinessAccess"
      WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
      LIMIT 1
    `;
    if (access.length > 0) return me;
  } catch {
    /* tabla puede no existir */
  }
  throw new Error("No tienes acceso a ese negocio.");
}

/* ═══════════════════════════ Crear requisición ═══════════════════════════ */

export type NewRequisitionInput = {
  businessId: string;
  title: string;
  note?: string | null;
  neededByIso?: string | null; // "YYYY-MM-DD"
  items: Array<{
    itemId: string;
    qtyRequested: number;
    note?: string | null;
    estimatedPriceCents?: number;
  }>;
};

export async function createRequisition(input: NewRequisitionInput) {
  const me = await assertManagerForBusiness(input.businessId);

  if (!input.title?.trim()) throw new Error("Falta el título de la requisición.");
  if (!input.items || input.items.length === 0) {
    throw new Error("Agrega al menos un producto.");
  }

  // Validar que todos los items existen y pertenecen al negocio
  const itemIds = input.items.map((i) => i.itemId);
  const validItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, businessId: input.businessId },
    select: { id: true, lastPriceCents: true },
  });
  if (validItems.length !== itemIds.length) {
    throw new Error("Algún producto no pertenece a este negocio o no existe.");
  }
  const priceByItem = new Map(validItems.map((i) => [i.id, i.lastPriceCents]));

  // Validar cantidades
  for (const line of input.items) {
    if (line.qtyRequested <= 0) {
      throw new Error("Las cantidades deben ser mayores a 0.");
    }
  }

  const requisition = await prisma.requisition.create({
    data: {
      businessId: input.businessId,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      neededBy: input.neededByIso
        ? new Date(input.neededByIso + "T00:00:00.000Z")
        : null,
      status: "SUBMITTED",
      createdById: (me as any).id,
      items: {
        create: input.items.map((line) => ({
          itemId: line.itemId,
          qtyRequested: line.qtyRequested,
          note: line.note?.trim() || null,
          estimatedPriceCents:
            line.estimatedPriceCents ?? priceByItem.get(line.itemId) ?? 0,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/app/inventory/requisitions");
  revalidatePath("/app/manager/ops");
  revalidatePath("/app/manager/restaurant");
  revalidatePath("/app/manager/ranch");

  return { ok: true, requisitionId: requisition.id };
}

/* ═══════════════════════════ Listar items para formulario ═══════════════════════════ */

export async function getInventoryItemsForBusiness(businessId: string) {
  return prisma.inventoryItem.findMany({
    where: { businessId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      unit: true,
      onHandQty: true,
      minQty: true,
      lastPriceCents: true,
      supplierName: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}
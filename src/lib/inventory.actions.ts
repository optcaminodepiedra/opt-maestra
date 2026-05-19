"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const INVENTORY_ROLES = ["INVENTORY"];

async function assertCanManageInventory(businessId: string) {
  const me = await getMe();
  const role = me.role as string;

  if ([...GLOBAL_ROLES, ...INVENTORY_ROLES].includes(role)) return me;

  const isMyBusiness =
    (me as any).primaryBusinessId === businessId ||
    (me as any).businessId === businessId;
  if (isMyBusiness) return me;

  try {
    const access = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "UserBusinessAccess"
      WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
      LIMIT 1
    `;
    if (access.length > 0) return me;
  } catch {}

  throw new Error("Sin permisos para manejar inventario de ese negocio.");
}

/**
 * Stock con filtros (negocio, búsqueda, categoría).
 */
export async function getStockSummary(businessId: string) {
  await assertCanManageInventory(businessId);

  const items = await prisma.inventoryItem.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const totalItems = items.length;
  const belowMin = items.filter((i: any) => i.onHandQty < i.minQty).length;
  const outOfStock = items.filter((i: any) => i.onHandQty === 0).length;
  const totalValueCents = items.reduce(
    (sum: number, i: any) => sum + i.onHandQty * i.lastPriceCents,
    0
  );

  const categories = Array.from(
    new Set(items.map((i: any) => i.category).filter(Boolean) as string[])
  ).sort();

  return {
    items: items.map((i: any) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: String(i.unit),
      onHandQty: i.onHandQty,
      minQty: i.minQty,
      maxQty: i.maxQty ?? 0,
      lastPriceCents: i.lastPriceCents,
      supplierName: i.supplierName,
      notes: i.notes ?? null,
      totalValueCents: i.onHandQty * i.lastPriceCents,
      belowMin: i.onHandQty < i.minQty,
      outOfStock: i.onHandQty === 0,
      aboveMax: (i.maxQty ?? 0) > 0 && i.onHandQty > i.maxQty,
    })),
    summary: { totalItems, belowMin, outOfStock, totalValueCents },
    categories,
  };
}

/**
 * Registra un movimiento manual (entrada/salida/ajuste).
 */
export async function createInventoryMovement(input: {
  itemId: string;
  type: "IN" | "OUT" | "ADJUST" | "TRANSFER";
  qty: number;
  note?: string;
  destinationBusinessId?: string | null;
}) {
  const me = await getMe();
  if (input.qty <= 0) throw new Error("La cantidad debe ser mayor a 0.");

  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.itemId },
    select: { id: true, businessId: true, name: true, onHandQty: true },
  });
  if (!item) throw new Error("Producto no encontrado.");

  await assertCanManageInventory(item.businessId);

  if (input.type === "OUT" && input.qty > item.onHandQty) {
    throw new Error(
      `Stock insuficiente. Hay ${item.onHandQty}, intentas sacar ${input.qty}.`
    );
  }

  let delta = 0;
  if (input.type === "IN") delta = input.qty;
  else if (input.type === "OUT") delta = -input.qty;
  else if (input.type === "ADJUST") delta = input.qty;
  else if (input.type === "TRANSFER") delta = -input.qty;

  const moveData: any = {
    businessId: item.businessId,
    itemId: item.id,
    type: input.type,
    qty: Math.abs(input.qty),
    note: input.note?.trim() || null,
    createdById: (me as any).id,
  };

  if (
    (input.type === "OUT" || input.type === "TRANSFER") &&
    input.destinationBusinessId
  ) {
    moveData.destinationBusinessId = input.destinationBusinessId;
  }

  await prisma.$transaction([
    prisma.inventoryMovement.create({ data: moveData }),
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { onHandQty: { increment: delta } },
    }),
  ]);

  revalidatePath("/app/inventory/stock");
  revalidatePath("/app/inventory/movements");
  revalidatePath("/app/inventory");
  return { ok: true };
}

/**
 * Lista movimientos recientes con info de origen y destino.
 */
export async function listInventoryMovements(opts: {
  businessId: string;
  limit?: number;
  type?: "IN" | "OUT" | "ADJUST" | "TRANSFER";
}) {
  await assertCanManageInventory(opts.businessId);

  const moves = await prisma.inventoryMovement.findMany({
    where: {
      businessId: opts.businessId,
      ...(opts.type && { type: opts.type }),
    },
    include: {
      item: { select: { name: true, sku: true, unit: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });

  const destBizIds = Array.from(
    new Set(
      (moves as any[])
        .map((m) => m.destinationBusinessId)
        .filter(Boolean) as string[]
    )
  );
  const destBizs =
    destBizIds.length > 0
      ? await prisma.business.findMany({
          where: { id: { in: destBizIds } },
          select: { id: true, name: true },
        })
      : [];
  const destBizMap = new Map(destBizs.map((b: any) => [b.id, b.name]));

  return (moves as any[]).map((m) => ({
    id: m.id,
    type: m.type,
    qty: m.qty,
    note: m.note,
    itemName: m.item.name,
    itemSku: m.item.sku,
    itemUnit: String(m.item.unit),
    createdAt: m.createdAt.toISOString(),
    createdByName: m.createdBy.fullName,
    destinationBusinessId: m.destinationBusinessId ?? null,
    destinationBusinessName: m.destinationBusinessId
      ? destBizMap.get(m.destinationBusinessId) ?? null
      : null,
  }));
}

/**
 * Lista los negocios disponibles como destino (excluyendo el origen).
 */
export async function getDestinationBusinesses(excludeBusinessId: string) {
  return prisma.business.findMany({
    where: { id: { not: excludeBusinessId } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Crea un nuevo producto en el catálogo de inventario de un negocio.
 * 🆕 Fase 11B: ahora acepta maxQty, notes, onHandQty inicial.
 */
export async function createInventoryItem(input: {
  businessId: string;
  name: string;
  sku?: string;
  category?: string;
  unit?: "PIECE" | "KG" | "LT" | "BOX" | "PACK";
  onHandQty?: number;
  minQty?: number;
  maxQty?: number;
  lastPriceCents?: number;
  supplierName?: string;
  notes?: string;
}) {
  await assertCanManageInventory(input.businessId);

  if (!input.name?.trim()) throw new Error("Falta el nombre del producto.");

  // Verificar duplicado por SKU si se proporciona
  if (input.sku?.trim()) {
    const exists = await prisma.inventoryItem.findFirst({
      where: { businessId: input.businessId, sku: input.sku.trim() },
      select: { id: true },
    });
    if (exists) throw new Error(`Ya existe un producto con SKU "${input.sku}".`);
  }

  // Validar maxQty si se proporciona
  if (input.maxQty != null && input.minQty != null && input.maxQty > 0 && input.maxQty < input.minQty) {
    throw new Error("El stock máximo no puede ser menor al mínimo.");
  }

  const me = await getMe();
  const initialOnHand = Math.max(0, input.onHandQty ?? 0);

  const created = await prisma.$transaction(async (tx: any) => {
    const item = await tx.inventoryItem.create({
      data: {
        businessId: input.businessId,
        name: input.name.trim(),
        sku: input.sku?.trim() || null,
        category: input.category?.trim() || null,
        unit: input.unit ?? "PIECE",
        onHandQty: initialOnHand,
        minQty: input.minQty ?? 0,
        maxQty: input.maxQty ?? 0,
        lastPriceCents: input.lastPriceCents ?? 0,
        supplierName: input.supplierName?.trim() || null,
        notes: input.notes?.trim() || null,
        isActive: true,
      } as any,
      select: { id: true, name: true },
    });

    // Si se proporcionó stock inicial > 0, registrar un movimiento IN para trazabilidad
    if (initialOnHand > 0) {
      await tx.inventoryMovement.create({
        data: {
          businessId: input.businessId,
          itemId: item.id,
          type: "IN" as any,
          qty: initialOnHand,
          note: "Stock inicial al crear producto",
          createdById: (me as any).id,
        },
      });
    }

    return item;
  });

  revalidatePath("/app/inventory/stock");
  revalidatePath("/app/inventory");
  revalidatePath("/app/manager/restaurant/inventory");
  revalidatePath("/app/manager/ranch/inventory");
  revalidatePath("/app/manager/ops");
  return { ok: true, id: created.id, name: created.name };
}

/**
 * Obtiene un producto individual para editarlo.
 * 🆕 Fase 11B
 */
export async function getInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
  });
  if (!item) throw new Error("Producto no encontrado.");

  await assertCanManageInventory(item.businessId);

  return {
    id: item.id,
    businessId: item.businessId,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: String(item.unit),
    onHandQty: item.onHandQty,
    minQty: item.minQty,
    maxQty: (item as any).maxQty ?? 0,
    lastPriceCents: item.lastPriceCents,
    supplierName: item.supplierName,
    notes: (item as any).notes ?? null,
    isActive: item.isActive,
  };
}

/**
 * Actualiza un producto existente.
 * 🆕 Fase 11B: ahora acepta maxQty, notes.
 */
export async function updateInventoryItem(input: {
  id: string;
  name?: string;
  sku?: string | null;
  category?: string | null;
  unit?: "PIECE" | "KG" | "LT" | "BOX" | "PACK";
  minQty?: number;
  maxQty?: number;
  lastPriceCents?: number;
  supplierName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.id },
    select: { businessId: true, sku: true },
  });
  if (!item) throw new Error("Producto no encontrado.");
  await assertCanManageInventory(item.businessId);

  // Validar SKU único si cambió
  if (input.sku !== undefined && input.sku && input.sku.trim() !== item.sku) {
    const dup = await prisma.inventoryItem.findFirst({
      where: {
        businessId: item.businessId,
        sku: input.sku.trim(),
        NOT: { id: input.id },
      },
      select: { id: true },
    });
    if (dup) throw new Error(`Ya existe otro producto con SKU "${input.sku}".`);
  }

  // Validar maxQty vs minQty si ambos se proporcionan
  if (input.maxQty != null && input.minQty != null && input.maxQty > 0 && input.maxQty < input.minQty) {
    throw new Error("El stock máximo no puede ser menor al mínimo.");
  }

  await prisma.inventoryItem.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.sku !== undefined && { sku: input.sku?.trim() || null }),
      ...(input.category !== undefined && { category: input.category?.trim() || null }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.minQty !== undefined && { minQty: input.minQty }),
      ...(input.maxQty !== undefined && { maxQty: input.maxQty }),
      ...(input.lastPriceCents !== undefined && { lastPriceCents: input.lastPriceCents }),
      ...(input.supplierName !== undefined && { supplierName: input.supplierName?.trim() || null }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    } as any,
  });

  revalidatePath("/app/inventory/stock");
  revalidatePath("/app/inventory");
  revalidatePath("/app/manager/restaurant/inventory");
  revalidatePath("/app/manager/ranch/inventory");
  revalidatePath(`/app/inventory/items/${input.id}/edit`);
  return { ok: true };
}

/**
 * Soft delete: marca el producto como inactivo.
 * No se borra de la BD para preservar histórico de movimientos.
 * 🆕 Fase 11B
 */
export async function deactivateInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { businessId: true, name: true, onHandQty: true },
  });
  if (!item) throw new Error("Producto no encontrado.");
  await assertCanManageInventory(item.businessId);

  await prisma.inventoryItem.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/app/inventory/stock");
  revalidatePath("/app/inventory");
  revalidatePath("/app/manager/restaurant/inventory");
  revalidatePath("/app/manager/ranch/inventory");
  return { ok: true, name: item.name, hadStock: item.onHandQty > 0 };
}

/**
 * Reactivar un producto previamente desactivado.
 * 🆕 Fase 11B
 */
export async function reactivateInventoryItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    select: { businessId: true, name: true },
  });
  if (!item) throw new Error("Producto no encontrado.");
  await assertCanManageInventory(item.businessId);

  await prisma.inventoryItem.update({
    where: { id },
    data: { isActive: true },
  });

  revalidatePath("/app/inventory/stock");
  revalidatePath("/app/inventory");
  revalidatePath("/app/manager/restaurant/inventory");
  revalidatePath("/app/manager/ranch/inventory");
  return { ok: true, name: item.name };
}

/**
 * Lista productos inactivos para poder reactivarlos.
 * 🆕 Fase 11B
 */
export async function listInactiveItems(businessId: string) {
  await assertCanManageInventory(businessId);

  const items = await prisma.inventoryItem.findMany({
    where: { businessId, isActive: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      onHandQty: true,
      updatedAt: true,
    },
  });

  return items.map((i: any) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    category: i.category,
    onHandQty: i.onHandQty,
    deactivatedAt: i.updatedAt.toISOString(),
  }));
}
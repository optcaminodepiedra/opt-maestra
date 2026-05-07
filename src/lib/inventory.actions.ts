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

  // Manager: solo su negocio
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
 * Solo Goyo y admins ven el almacén general.
 */
export async function getStockSummary(businessId: string) {
  await assertCanManageInventory(businessId);

  const items = await prisma.inventoryItem.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Estadísticas
  const totalItems = items.length;
  const belowMin = items.filter((i) => i.onHandQty < i.minQty).length;
  const outOfStock = items.filter((i) => i.onHandQty === 0).length;
  const totalValueCents = items.reduce(
    (sum, i) => sum + i.onHandQty * i.lastPriceCents,
    0
  );

  // Lista de categorías únicas
  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean) as string[])
  ).sort();

  return {
    items: items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      unit: String(i.unit),
      onHandQty: i.onHandQty,
      minQty: i.minQty,
      lastPriceCents: i.lastPriceCents,
      supplierName: i.supplierName,
      totalValueCents: i.onHandQty * i.lastPriceCents,
      belowMin: i.onHandQty < i.minQty,
      outOfStock: i.onHandQty === 0,
    })),
    summary: {
      totalItems,
      belowMin,
      outOfStock,
      totalValueCents,
    },
    categories,
  };
}

/**
 * Registra un movimiento manual (entrada/salida/ajuste).
 * Para SALIDA permite especificar un negocio destino opcional.
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

  // Cargar el item para saber a qué businessId pertenece
  const item = await prisma.inventoryItem.findUnique({
    where: { id: input.itemId },
    select: { id: true, businessId: true, name: true, onHandQty: true },
  });
  if (!item) throw new Error("Producto no encontrado.");

  await assertCanManageInventory(item.businessId);

  // Para SALIDA y AJUSTE-negativo validar que haya stock
  if (input.type === "OUT" && input.qty > item.onHandQty) {
    throw new Error(
      `Stock insuficiente. Hay ${item.onHandQty}, intentas sacar ${input.qty}.`
    );
  }

  // Calcular delta para actualizar stock
  let delta = 0;
  if (input.type === "IN") delta = input.qty;
  else if (input.type === "OUT") delta = -input.qty;
  else if (input.type === "ADJUST") delta = input.qty; // qty puede ser negativa o positiva (lo manejamos asi)
  else if (input.type === "TRANSFER") delta = -input.qty;

  // Construir el create con destinationBusinessId si aplica
  const moveData: any = {
    businessId: item.businessId,
    itemId: item.id,
    type: input.type,
    qty: Math.abs(input.qty),
    note: input.note?.trim() || null,
    createdById: (me as any).id,
  };

  // Solo OUT y TRANSFER aceptan destinationBusinessId
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

  // Si Prisma todavía no reconoce destinationBusiness, lo cargamos manualmente
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
  const destBizMap = new Map(destBizs.map((b) => [b.id, b.name]));

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

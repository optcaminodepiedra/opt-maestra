"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MovementType, RequisitionStatus, StockUnit } from "@prisma/client";

function rv() {
  revalidatePath("/app/inventory");
}

export async function getInventoryBootData(businessId?: string) {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const bid = businessId || businesses[0]?.id || null;

  const items = bid
    ? await prisma.inventoryItem.findMany({
        where: { businessId: bid, isActive: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
    : [];

  const lowStock = items.filter((i) => (i.onHandQty ?? 0) <= (i.minQty ?? 0));

  const recentMovements = bid
    ? await prisma.inventoryMovement.findMany({
        where: { businessId: bid },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { item: true, createdBy: true },
      })
    : [];

  const requisitions = bid
    ? await prisma.requisition.findMany({
        where: { businessId: bid },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          createdBy: true,
          approvedBy: true,
          items: { include: { item: true } },
        },
      })
    : [];

  const totals = {
    itemsCount: items.length,
    lowStockCount: lowStock.length,
    onHandTotal: items.reduce((sum, it) => sum + (it.onHandQty ?? 0), 0),
  };

  return {
    businesses,
    businessId: bid,
    items,
    lowStock,
    recentMovements,
    requisitions,
    totals,
  };
}

export async function createInventoryItem(input: {
  businessId: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit?: StockUnit;
  minQty?: number;
  onHandQty?: number;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.name?.trim()) throw new Error("Falta nombre");

  await prisma.inventoryItem.create({
    data: {
      businessId: input.businessId,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      category: input.category?.trim() || null,
      unit: input.unit ?? StockUnit.PIECE,
      minQty: Math.max(0, Math.floor(input.minQty ?? 0)),
      onHandQty: Math.max(0, Math.floor(input.onHandQty ?? 0)),
      isActive: true,
    },
  });

  rv();
  return true;
}

export async function addInventoryMovement(input: {
  businessId: string;
  itemId: string;
  type: MovementType;
  qty: number;
  note?: string | null;
  createdById: string;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.itemId) throw new Error("Falta item");
  if (!input.createdById) throw new Error("Falta usuario");
  const qty = Math.max(1, Math.floor(input.qty || 1));

  const item = await prisma.inventoryItem.findUnique({ where: { id: input.itemId } });
  if (!item) throw new Error("Item no existe");

  // Reglas básicas para onHand:
  // IN suma, OUT resta, ADJUST aplica +qty o -qty según signo (aquí usamos qty positivo y pedimos tipo)
  let nextOnHand = item.onHandQty ?? 0;

  if (input.type === MovementType.IN) nextOnHand += qty;
  if (input.type === MovementType.OUT) nextOnHand = Math.max(0, nextOnHand - qty);
  if (input.type === MovementType.ADJUST) nextOnHand = Math.max(0, nextOnHand + qty);

  await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        businessId: input.businessId,
        itemId: input.itemId,
        type: input.type,
        qty,
        note: input.note?.trim() || null,
        createdById: input.createdById,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: input.itemId },
      data: { onHandQty: nextOnHand },
    }),
  ]);

  rv();
  return true;
}

export async function createRequisition(input: {
  businessId: string;
  title: string;
  note?: string | null;
  neededBy?: string | null; // ISO
  createdById: string;
  items: Array<{ itemId: string; qtyRequested: number; note?: string | null }>;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.createdById) throw new Error("Falta usuario");
  if (!input.title?.trim()) throw new Error("Falta título");
  if (!input.items?.length) throw new Error("Faltan items");

  const cleanItems = input.items
    .filter((x) => x.itemId && Number.isFinite(x.qtyRequested))
    .map((x) => ({
      itemId: x.itemId,
      qtyRequested: Math.max(1, Math.floor(x.qtyRequested)),
      note: x.note?.trim() || null,
    }));

  if (!cleanItems.length) throw new Error("Items inválidos");

  await prisma.requisition.create({
    data: {
      businessId: input.businessId,
      status: RequisitionStatus.DRAFT,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      neededBy: input.neededBy ? new Date(input.neededBy) : null,
      createdById: input.createdById,
      items: {
        create: cleanItems,
      },
    },
  });

  rv();
  return true;
}

export async function submitRequisition(requisitionId: string) {
  if (!requisitionId) throw new Error("Falta requisición");

  await prisma.requisition.update({
    where: { id: requisitionId },
    data: { status: RequisitionStatus.SUBMITTED },
  });

  rv();
  return true;
}

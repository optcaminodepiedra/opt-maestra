"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function requestRestock(itemId: string, businessId: string, userId: string) {
  if (!itemId || !businessId || !userId) throw new Error("Faltan datos para crear la requisición");

  // 1. Revisamos que no haya ya una petición en curso para no duplicar pedidos
  const existingReq = await prisma.requisitionItem.findFirst({
    where: {
      itemId: itemId,
      requisition: {
        status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"] }
      }
    }
  });

  if (existingReq) {
    throw new Error("¡Ojo! Ya hay una requisición en proceso para este producto.");
  }

  // 2. Buscamos el producto para saber cuánto pedir sugerido (pediremos para que llegue a 10 por defecto, o el doble del mínimo)
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Producto no encontrado");
  
  const suggestedQty = item.minQty > 0 ? item.minQty * 2 : 10;

  // 3. Creamos la requisición en estado SUBMITTED (Esperando que Almacén confirme)
  await prisma.requisition.create({
    data: {
      businessId,
      title: `Resurtido Urgente: ${item.name}`,
      status: "SUBMITTED", // Se salta el Draft y va directo a revisión
      createdById: userId,
      items: {
        create: {
          itemId: item.id,
          qtyRequested: suggestedQty,
          estimatedPriceCents: item.lastPriceCents // Jalamos el último precio conocido
        }
      }
    }
  });

  revalidatePath("/app/inventory");
  return true;
}
// Agrégala hasta el final del archivo

export async function approveRequisition(reqId: string, userId: string) {
  if (!reqId || !userId) throw new Error("Faltan datos para aprobar");

  await prisma.requisition.update({
    where: { id: reqId },
    data: {
      status: "APPROVED",
      approvedById: userId,
      // Al aprobar, copiamos la cantidad solicitada a la cantidad aprobada para todos sus items
      // (En un futuro podrías editar esto si piden 10 pero solo apruebas 5)
    }
  });

  // Refrescamos las pantallas
  revalidatePath("/app/inventory/requisitions");
  revalidatePath("/app/inventory");
  return true;
}

export async function deleteRequisition(reqId: string) {
  if (!reqId) throw new Error("Falta el ID");
  await prisma.requisition.delete({ where: { id: reqId } });
  revalidatePath("/app/inventory/requisitions");
  revalidatePath("/app/inventory");
  return true;
}

// Agrégalo al final del archivo
export async function createInventoryItem(data: {
  businessId: string;
  name: string;
  sku?: string;
  category?: string;
  unit: "PIECE" | "KG" | "LT" | "BOX" | "PACK";
  minQty: number;
  lastPriceCents: number;
  supplierName?: string;
}) {
  if (!data.name || !data.businessId) throw new Error("Faltan datos obligatorios");

  const newItem = await prisma.inventoryItem.create({
    data: {
      ...data,
      onHandQty: 0, // Inicia en 0. Para sumarle piezas, usaremos la pantalla de Movimientos después
      isActive: true,
    }
  });

  revalidatePath("/app/inventory");
  return newItem.id;
}

// Agrégalo al final del archivo
export async function createInventoryMovement(data: {
  businessId: string;
  itemId: string;
  userId: string;
  type: "IN" | "OUT";
  qty: number;
  note?: string;
}) {
  if (!data.itemId || !data.qty || data.qty <= 0) {
    throw new Error("Producto y cantidad mayor a 0 son requeridos");
  }

  // 1. Buscamos el producto actual para saber cuánto tiene
  const item = await prisma.inventoryItem.findUnique({
    where: { id: data.itemId }
  });

  if (!item) throw new Error("Producto no encontrado");

  // 2. Calculamos la nueva existencia
  let newQty = item.onHandQty;
  if (data.type === "IN") {
    newQty += data.qty; // Si entra, sumamos
  } else if (data.type === "OUT") {
    newQty -= data.qty; // Si sale, restamos
    if (newQty < 0) newQty = 0; // Evitamos inventarios negativos por error de dedo
  }

  // 3. Guardamos el movimiento y actualizamos el producto AL MISMO TIEMPO (Transacción)
  await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        businessId: data.businessId,
        itemId: data.itemId,
        type: data.type,
        qty: data.qty,
        note: data.note,
        createdById: data.userId
      }
    }),
    prisma.inventoryItem.update({
      where: { id: data.itemId },
      data: { onHandQty: newQty }
    })
  ]);

  // Refrescamos la Torre de Control
  revalidatePath("/app/inventory");
  return true;
}

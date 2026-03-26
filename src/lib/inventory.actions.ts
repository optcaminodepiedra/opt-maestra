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
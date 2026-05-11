"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

/**
 * Carga una orden completa con items y menú del negocio.
 * Verifica permisos del usuario.
 */
export async function getOrderForPOS(orderId: string) {
  const me = await getMe();
  const role = (me as any).role as string;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: {
      table: { select: { id: true, name: true, area: true, capacity: true } },
      user: { select: { id: true, fullName: true } },
      items: {
        include: {
          menuItem: {
            select: { id: true, name: true, category: true, station: true } as any,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) throw new Error("Orden no encontrada");

  const ok = await userCanAccessBusiness((me as any).id, role, order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  const menuItems = await prisma.menuItem.findMany({
    where: { businessId: order.businessId, isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" } as any, { name: "asc" }],
  });

  const categories: Record<string, typeof menuItems> = {};
  for (const item of menuItems) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  }

  const total = order.items.reduce((s, i) => s + i.qty * i.priceCents, 0);

  return {
    order: {
      id: order.id,
      businessId: order.businessId,
      tableId: order.tableId,
      tableName: order.table?.name ?? "?",
      tableArea: order.table?.area ?? null,
      tableCapacity: order.table?.capacity ?? 0,
      mesero: order.user?.fullName ?? "?",
      status: order.status,
      note: order.note,
      openedAt: order.openedAt.toISOString(),
      totalCents: total,
      items: order.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        name: i.menuItem.name,
        category: i.menuItem.category,
        station: (i.menuItem as any).station ?? "KITCHEN",
        qty: i.qty,
        priceCents: i.priceCents,
        note: i.note,
        kitchenStatus: i.kitchenStatus,
        subtotalCents: i.qty * i.priceCents,
      })),
    },
    menu: {
      categories,
      categoryNames: Object.keys(categories).sort(),
      items: menuItems,
    },
  };
}

/**
 * Agrega un producto a la orden. Optimizado: NO revalida si ya hay re-fetch en cliente.
 */
export async function addItemToOrder(input: {
  orderId: string;
  menuItemId: string;
  qty?: number;
  note?: string;
}) {
  const me = await getMe();
  const role = (me as any).role as string;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    select: { id: true, businessId: true, status: true },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (!["OPEN", "SENT"].includes(order.status)) {
    throw new Error("Solo se pueden agregar productos a órdenes abiertas");
  }

  const ok = await userCanAccessBusiness((me as any).id, role, order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  const menuItem = await prisma.menuItem.findUnique({
    where: { id: input.menuItemId },
    select: { id: true, businessId: true, name: true, priceCents: true, isActive: true, category: true, station: true as any },
  });
  if (!menuItem) throw new Error("Producto no encontrado");
  if (menuItem.businessId !== order.businessId) {
    throw new Error("El producto pertenece a otro restaurante");
  }
  if (!menuItem.isActive) throw new Error("Producto no disponible");

  const qty = Math.max(1, input.qty ?? 1);
  const noteVal = input.note?.trim() || null;

  // Consolidar si no hay nota
  if (!noteVal) {
    const existing = await prisma.restaurantOrderItem.findFirst({
      where: {
        orderId: order.id,
        menuItemId: menuItem.id,
        note: null,
        kitchenStatus: "NEW",
      },
    });
    if (existing) {
      const updated = await prisma.restaurantOrderItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + qty },
      });
      // Retornar el item actualizado para optimistic UI
      return {
        ok: true,
        consolidated: true,
        item: {
          id: updated.id,
          menuItemId: menuItem.id,
          name: menuItem.name,
          category: menuItem.category,
          station: (menuItem as any).station ?? "KITCHEN",
          qty: updated.qty,
          priceCents: updated.priceCents,
          note: null,
          kitchenStatus: "NEW",
          subtotalCents: updated.qty * updated.priceCents,
        },
      };
    }
  }

  const created = await prisma.restaurantOrderItem.create({
    data: {
      orderId: order.id,
      menuItemId: menuItem.id,
      qty,
      priceCents: menuItem.priceCents,
      note: noteVal,
      kitchenStatus: "NEW",
    },
  });

  return {
    ok: true,
    consolidated: false,
    item: {
      id: created.id,
      menuItemId: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      station: (menuItem as any).station ?? "KITCHEN",
      qty: created.qty,
      priceCents: created.priceCents,
      note: created.note,
      kitchenStatus: "NEW",
      subtotalCents: created.qty * created.priceCents,
    },
  };
}

/**
 * Cambia la cantidad de un item. Si qty=0, lo elimina.
 */
export async function updateItemQuantity(input: { itemId: string; qty: number }) {
  const me = await getMe();
  const role = (me as any).role as string;

  const item = await prisma.restaurantOrderItem.findUnique({
    where: { id: input.itemId },
    include: { order: { select: { id: true, businessId: true, status: true } } },
  });
  if (!item) throw new Error("Item no encontrado");
  if (!["OPEN", "SENT"].includes(item.order.status)) {
    throw new Error("Orden cerrada");
  }
  if (item.kitchenStatus !== "NEW") {
    throw new Error("No se puede modificar un item ya enviado a cocina");
  }

  const ok = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  if (input.qty <= 0) {
    await prisma.restaurantOrderItem.delete({ where: { id: input.itemId } });
    return { ok: true, deleted: true };
  }

  const updated = await prisma.restaurantOrderItem.update({
    where: { id: input.itemId },
    data: { qty: input.qty },
  });
  return { ok: true, deleted: false, item: { id: updated.id, qty: updated.qty } };
}

/**
 * Actualiza la nota de un item.
 */
export async function updateItemNote(input: { itemId: string; note: string }) {
  const me = await getMe();
  const role = (me as any).role as string;

  const item = await prisma.restaurantOrderItem.findUnique({
    where: { id: input.itemId },
    include: { order: { select: { id: true, businessId: true, status: true } } },
  });
  if (!item) throw new Error("Item no encontrado");
  if (item.kitchenStatus !== "NEW") {
    throw new Error("No se puede modificar un item ya enviado a cocina");
  }
  const ok = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  await prisma.restaurantOrderItem.update({
    where: { id: input.itemId },
    data: { note: input.note.trim() || null },
  });
  return { ok: true };
}

/**
 * Envía los items NEW a cocina (marca como PREPARING).
 * Cambia el estado de la orden a SENT.
 *
 * FIX: ya no escribe sentToKitchenAt (campo no existe en schema).
 */
export async function sendOrderToKitchen(orderId: string) {
  const me = await getMe();
  const role = (me as any).role as string;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true, kitchenStatus: true } } },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (!["OPEN", "SENT"].includes(order.status)) {
    throw new Error("Orden cerrada");
  }
  const ok = await userCanAccessBusiness((me as any).id, role, order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  const newItems = order.items.filter((i) => i.kitchenStatus === "NEW");
  if (newItems.length === 0) {
    throw new Error("No hay items nuevos para enviar a cocina");
  }

  // Solo updates, sin sentToKitchenAt
  await prisma.$transaction([
    prisma.restaurantOrderItem.updateMany({
      where: { id: { in: newItems.map((i) => i.id) } },
      data: { kitchenStatus: "PREPARING" },
    }),
    prisma.restaurantOrder.update({
      where: { id: orderId },
      data: { status: "SENT" },
    }),
  ]);

  revalidatePath(`/app/restaurant/pos/${orderId}`);
  revalidatePath("/app/restaurant/tables");
  return { ok: true, itemsSent: newItems.length };
}

/**
 * Cierra y cobra la orden, generando un Sale.
 * Permite cobrar SIN haber enviado a cocina (caso experiencias/RZR).
 * Si hay items NEW, los marca como DELIVERED automáticamente.
 */
export async function checkoutOrder(input: {
  orderId: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
  cashpointId: string;
  tipCents?: number;
}) {
  const me = await getMe();
  const role = (me as any).role as string;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
      table: { select: { name: true } },
    },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (order.status === "PAID" || order.status === "CANCELED") {
    throw new Error("Orden ya cerrada");
  }
  if (order.items.length === 0) {
    throw new Error("La orden está vacía");
  }

  const ok = await userCanAccessBusiness((me as any).id, role, order.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  const subtotal = order.items.reduce((s, i) => s + i.qty * i.priceCents, 0);
  const tipCents = Math.max(0, input.tipCents ?? 0);
  const totalCents = subtotal + tipCents;

  const cp = await prisma.cashpoint.findUnique({ where: { id: input.cashpointId } });
  if (!cp || cp.businessId !== order.businessId) {
    throw new Error("Caja inválida para este negocio");
  }

  const concept = `Mesa ${order.table?.name ?? "?"} · Orden #${order.id.slice(-6).toUpperCase()}`;

  // Marcar items NEW como DELIVERED (bypass cocina cuando se cobra directo)
  const newItems = order.items.filter((i) => i.kitchenStatus === "NEW");

  await prisma.$transaction([
    // Si hay items NEW (cobrar sin pasar por cocina), marcarlos DELIVERED
    ...(newItems.length > 0
      ? [
          prisma.restaurantOrderItem.updateMany({
            where: { id: { in: newItems.map((i) => i.id) } },
            data: { kitchenStatus: "DELIVERED" },
          }),
        ]
      : []),
    prisma.sale.create({
      data: {
        businessId: order.businessId,
        cashpointId: input.cashpointId,
        userId: (me as any).id,
        amountCents: totalCents,
        method: input.paymentMethod,
        concept,
      },
    }),
    prisma.restaurantOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        closedAt: new Date(),
      },
    }),
  ]);

  revalidatePath(`/app/restaurant/pos/${order.id}`);
  revalidatePath("/app/restaurant/tables");

  return {
    ok: true,
    totalCents,
    subtotalCents: subtotal,
    tipCents,
  };
}

/**
 * Lista los cashpoints disponibles del negocio.
 */
export async function getCashpointsForBusiness(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  return prisma.cashpoint.findMany({
    where: { businessId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

/**
 * Carga todas las órdenes activas para una estación.
 * Filtra items según station (KITCHEN o BAR).
 */
export async function getKDSOrders(input: {
  businessId: string;
  station: "KITCHEN" | "BAR" | "ALL";
}) {
  const me = await getMe();
  const role = (me as any).role as string;

  const ok = await userCanAccessBusiness((me as any).id, role, input.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  // Buscar órdenes en estado SENT (enviadas a cocina) o OPEN con items PREPARING
  const orders = await prisma.restaurantOrder.findMany({
    where: {
      businessId: input.businessId,
      status: { in: ["OPEN", "SENT"] },
    },
    include: {
      table: { select: { name: true, area: true } },
      user: { select: { fullName: true } },
      items: {
        where: {
          kitchenStatus: { in: ["PREPARING", "READY"] },
          ...(input.station !== "ALL"
            ? {
                menuItem: {
                  station: input.station as any,
                },
              }
            : {}),
        },
        include: {
          menuItem: {
            select: { name: true, category: true, station: true } as any,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { openedAt: "asc" },
  });

  // Filtrar órdenes que tengan items en esta estación
  const filtered = orders.filter((o) => o.items.length > 0);

  const now = new Date();
  return filtered.map((order) => {
    const minutesElapsed = Math.floor(
      (now.getTime() - new Date(order.openedAt).getTime()) / 60000
    );
    const allReady = order.items.length > 0 && order.items.every((i) => i.kitchenStatus === "READY");
    const anyPreparing = order.items.some((i) => i.kitchenStatus === "PREPARING");

    return {
      id: order.id,
      tableName: order.table?.name ?? "?",
      tableArea: order.table?.area ?? null,
      mesero: order.user?.fullName ?? "?",
      note: order.note,
      openedAt: order.openedAt.toISOString(),
      minutesElapsed,
      itemCount: order.items.length,
      allReady,
      anyPreparing,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.menuItem.name,
        category: i.menuItem.category,
        station: (i.menuItem as any).station ?? "KITCHEN",
        qty: i.qty,
        note: i.note,
        kitchenStatus: i.kitchenStatus,
      })),
    };
  });
}

/**
 * Marca un item como READY.
 */
export async function markItemReady(itemId: string) {
  const me = await getMe();
  const role = (me as any).role as string;

  const item = await prisma.restaurantOrderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { businessId: true, id: true } } },
  });
  if (!item) throw new Error("Item no encontrado");

  const ok = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
  if (!ok) throw new Error("Sin acceso");

  await prisma.restaurantOrderItem.update({
    where: { id: itemId },
    data: { kitchenStatus: "READY" },
  });

  revalidatePath("/app/restaurant/kds");
  revalidatePath(`/app/restaurant/pos/${item.order.id}`);
  return { ok: true };
}

/**
 * Marca un item como DELIVERED.
 */
export async function markItemDelivered(itemId: string) {
  const me = await getMe();
  const role = (me as any).role as string;

  const item = await prisma.restaurantOrderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { businessId: true, id: true } } },
  });
  if (!item) throw new Error("Item no encontrado");

  const ok = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
  if (!ok) throw new Error("Sin acceso");

  await prisma.restaurantOrderItem.update({
    where: { id: itemId },
    data: { kitchenStatus: "DELIVERED" },
  });

  revalidatePath("/app/restaurant/kds");
  revalidatePath(`/app/restaurant/pos/${item.order.id}`);
  return { ok: true };
}

/**
 * Marca TODA una orden como READY (todos los items).
 */
export async function markOrderReady(input: { orderId: string; station: "KITCHEN" | "BAR" | "ALL" }) {
  const me = await getMe();
  const role = (me as any).role as string;

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    select: { businessId: true },
  });
  if (!order) throw new Error("Orden no encontrada");

  const ok = await userCanAccessBusiness((me as any).id, role, order.businessId);
  if (!ok) throw new Error("Sin acceso");

  await prisma.restaurantOrderItem.updateMany({
    where: {
      orderId: input.orderId,
      kitchenStatus: "PREPARING",
      ...(input.station !== "ALL"
        ? {
            menuItem: {
              station: input.station as any,
            },
          }
        : {}),
    },
    data: { kitchenStatus: "READY" },
  });

  revalidatePath("/app/restaurant/kds");
  revalidatePath(`/app/restaurant/pos/${input.orderId}`);
  return { ok: true };
}

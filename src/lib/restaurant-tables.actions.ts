"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Carga todas las mesas de un negocio agrupadas por área,
 * con info de la orden actual abierta (si existe).
 */
export async function getTablesWithStatus(businessId: string) {
  const tables = await prisma.restaurantTable.findMany({
    where: { businessId, isActive: true },
    include: {
      orders: {
        where: { status: { in: ["OPEN", "SENT"] } },
        include: {
          user: { select: { fullName: true } },
          items: {
            select: {
              id: true,
              qty: true,
              priceCents: true,
              kitchenStatus: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Calcular el estado de cada mesa
  const now = new Date();
  const result = tables.map((t) => {
    const activeOrder = t.orders[0];
    let status: "FREE" | "OCCUPIED" | "READY_TO_BILL" | "RESERVED" = "FREE";
    let totalCents = 0;
    let openedAt: Date | null = null;
    let minutesElapsed = 0;
    let mesero: string | null = null;
    let itemCount = 0;
    let pendingKitchen = 0;

    if (activeOrder) {
      mesero = activeOrder.user?.fullName ?? null;
      openedAt = activeOrder.openedAt;
      itemCount = activeOrder.items.length;
      pendingKitchen = activeOrder.items.filter(
        (i) => i.kitchenStatus === "NEW" || i.kitchenStatus === "PREPARING"
      ).length;
      totalCents = activeOrder.items.reduce(
        (sum, i) => sum + i.qty * i.priceCents,
        0
      );
      minutesElapsed = Math.floor(
        (now.getTime() - new Date(activeOrder.openedAt).getTime()) / 60000
      );

      if (activeOrder.status === "SENT" && pendingKitchen === 0) {
        status = "READY_TO_BILL";
      } else {
        status = "OCCUPIED";
      }
    }

    return {
      id: t.id,
      name: t.name,
      area: t.area || "Sin área",
      capacity: t.capacity,
      status,
      activeOrderId: activeOrder?.id ?? null,
      mesero,
      openedAtIso: openedAt?.toISOString() ?? null,
      minutesElapsed,
      itemCount,
      pendingKitchen,
      totalCents,
    };
  });

  // Agrupar por área
  const byArea: Record<string, typeof result> = {};
  for (const t of result) {
    if (!byArea[t.area]) byArea[t.area] = [];
    byArea[t.area].push(t);
  }

  // Resumen
  const summary = {
    total: result.length,
    free: result.filter((t) => t.status === "FREE").length,
    occupied: result.filter((t) => t.status === "OCCUPIED").length,
    readyToBill: result.filter((t) => t.status === "READY_TO_BILL").length,
    activeOrders: result.filter((t) => t.activeOrderId).length,
    totalSalesOpenCents: result.reduce((s, t) => s + t.totalCents, 0),
  };

  return { byArea, summary, areas: Object.keys(byArea).sort() };
}

/**
 * Abre una nueva orden en una mesa libre, asignando mesero y nº de comensales.
 */
export async function openOrderAtTable(input: {
  tableId: string;
  meseroId?: string;
  pax?: number;
  note?: string;
}) {
  const me = await getMe();

  const table = await prisma.restaurantTable.findUnique({
    where: { id: input.tableId },
    select: { id: true, businessId: true, name: true, isActive: true },
  });
  if (!table) throw new Error("Mesa no encontrada");
  if (!table.isActive) throw new Error("Mesa inactiva");

  // Verificar que no haya orden abierta
  const existingOpen = await prisma.restaurantOrder.findFirst({
    where: {
      tableId: table.id,
      status: { in: ["OPEN", "SENT"] },
    },
  });
  if (existingOpen) {
    throw new Error(`La mesa ${table.name} ya tiene una orden abierta.`);
  }

  // Validar mesero si se proporciona
  const userId = input.meseroId ?? (me as any).id;
  const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists) throw new Error("Mesero no válido");

  const order = await prisma.restaurantOrder.create({
    data: {
      businessId: table.businessId,
      tableId: table.id,
      userId,
      status: "OPEN",
      note: input.note?.trim() || null,
    },
  });

  revalidatePath(`/app/restaurant/tables`);
  return { ok: true, orderId: order.id };
}

/**
 * Lista usuarios disponibles para ser mesero en este negocio.
 * (Filtra por rol staff_waiter, manager_*, master_admin, owner)
 */
export async function getMeserosForBusiness(businessId: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { primaryBusinessId: businessId },
        { role: { in: ["MASTER_ADMIN", "OWNER", "SUPERIOR"] } },
      ],
      role: {
        in: [
          "MASTER_ADMIN", "OWNER", "SUPERIOR",
          "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER",
          "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
        ],
      },
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      role: true,
    },
    orderBy: { fullName: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.fullName,
    jobTitle: u.jobTitle,
    role: u.role,
  }));
}

/**
 * Mueve una orden a otra mesa (reasignar mesa).
 */
export async function moveOrderToTable(input: {
  orderId: string;
  newTableId: string;
}) {
  const me = await getMe();

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    select: { id: true, businessId: true, status: true, tableId: true },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (!["OPEN", "SENT"].includes(order.status)) {
    throw new Error("Solo se pueden mover órdenes abiertas");
  }

  const newTable = await prisma.restaurantTable.findUnique({
    where: { id: input.newTableId },
    select: { id: true, name: true, businessId: true, isActive: true },
  });
  if (!newTable) throw new Error("Mesa destino no encontrada");
  if (newTable.businessId !== order.businessId) {
    throw new Error("La mesa destino es de otro negocio");
  }

  // Verificar que la mesa destino esté libre
  const conflicting = await prisma.restaurantOrder.findFirst({
    where: {
      tableId: newTable.id,
      status: { in: ["OPEN", "SENT"] },
    },
  });
  if (conflicting) {
    throw new Error(`Mesa ${newTable.name} ya tiene una orden abierta`);
  }

  await prisma.restaurantOrder.update({
    where: { id: order.id },
    data: { tableId: newTable.id },
  });

  revalidatePath(`/app/restaurant/tables`);
  return { ok: true };
}

/**
 * Cierra (cancela) una orden vacía (sin items) — útil cuando alguien abrió mesa por error.
 */
export async function discardEmptyOrder(orderId: string) {
  const me = await getMe();
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: { _count: { select: { items: true } } },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (order._count.items > 0) {
    throw new Error("No se puede descartar una orden con productos. Cobra o anula primero.");
  }

  await prisma.restaurantOrder.delete({ where: { id: orderId } });
  revalidatePath(`/app/restaurant/tables`);
  return { ok: true };
}

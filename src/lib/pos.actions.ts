"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

// Roles que pueden cancelar items YA enviados a cocina (Fase 11D)
const MANAGER_AND_UP = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER", "MANAGER_HOTEL",
];

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

  const total = order.items.reduce((s: number, i: any) => s + i.qty * i.priceCents, 0);

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
      // 👇 FIX Fase 11D: filtrado defensivo - solo items con menuItem válido
      items: order.items
        .filter((i: any) => i.menuItem != null)
        .map((i: any) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          name: i.menuItem.name,
          category: i.menuItem.category ?? "sin categoría",
          station: i.menuItem.station ?? "KITCHEN",
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
 *
 * 🔧 FIX Fase 11E: Ultra-resiliente. NUNCA tira excepción.
 * Devuelve { ok: false, error } en lugar de throw, para que NO crashee el Server Component.
 */
export async function updateItemQuantity(input: { itemId: string; qty: number }) {
  try {
    const me = await getMe();
    const role = (me as any).role as string;

    let item;
    try {
      item = await prisma.restaurantOrderItem.findUnique({
        where: { id: input.itemId },
        include: { order: { select: { id: true, businessId: true, status: true } } },
      });
    } catch (queryErr: any) {
      console.error("[pos.actions/updateItemQuantity] Error en findUnique:", queryErr);
      return { ok: false, error: "No se pudo cargar el item" };
    }

    // Item ya no existe (race condition o borrado previo) → ok
    if (!item) {
      return { ok: true, deleted: true, alreadyGone: true };
    }

    if (!["OPEN", "SENT"].includes(item.order.status)) {
      return { ok: false, error: "La orden ya está cerrada y no se puede modificar" };
    }
    if (item.kitchenStatus !== "NEW") {
      return { ok: false, error: "Este platillo ya está en cocina. Usa el botón de cancelar." };
    }

    let canAccess = false;
    try {
      canAccess = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
    } catch (accessErr: any) {
      console.error("[pos.actions/updateItemQuantity] Error en userCanAccessBusiness:", accessErr);
    }
    if (!canAccess) {
      return { ok: false, error: "No tienes acceso a este restaurante" };
    }

    if (input.qty <= 0) {
      try {
        const result = await prisma.restaurantOrderItem.deleteMany({
          where: { id: input.itemId },
        });
        try {
          revalidatePath(`/app/restaurant/pos/${item.order.id}`);
        } catch {}
        return { ok: true, deleted: true, alreadyGone: result.count === 0 };
      } catch (deleteErr: any) {
        if (deleteErr.code === "P2025") {
          return { ok: true, deleted: true, alreadyGone: true };
        }
        console.error("[pos.actions/updateItemQuantity] Error en delete:", deleteErr);
        return { ok: false, error: "No se pudo eliminar el platillo" };
      }
    }

    try {
      const updated = await prisma.restaurantOrderItem.update({
        where: { id: input.itemId },
        data: { qty: input.qty },
      });
      try {
        revalidatePath(`/app/restaurant/pos/${item.order.id}`);
      } catch {}
      return { ok: true, deleted: false, item: { id: updated.id, qty: updated.qty } };
    } catch (updateErr: any) {
      if (updateErr.code === "P2025") {
        return { ok: true, deleted: true, alreadyGone: true };
      }
      console.error("[pos.actions/updateItemQuantity] Error en update:", updateErr);
      return { ok: false, error: "No se pudo actualizar la cantidad" };
    }
  } catch (err: any) {
    // 🔧 FIX 11E: capturar TODO. NUNCA throw.
    console.error("[pos.actions/updateItemQuantity] Error inesperado:", err);
    console.error("[pos.actions/updateItemQuantity] Stack:", err?.stack);
    return { ok: false, error: err?.message || "Error inesperado" };
  }
}

/**
 * Actualiza la nota de un item.
 *
 * 🔧 FIX Fase 11E: Ultra-resiliente. NUNCA tira excepción.
 */
export async function updateItemNote(input: { itemId: string; note: string }) {
  try {
    const me = await getMe();
    const role = (me as any).role as string;

    const item = await prisma.restaurantOrderItem.findUnique({
      where: { id: input.itemId },
      include: { order: { select: { id: true, businessId: true, status: true } } },
    });
    if (!item) return { ok: true, alreadyGone: true };
    if (item.kitchenStatus !== "NEW") {
      return { ok: false, error: "No se puede modificar un item ya enviado a cocina" };
    }
    const canAccess = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
    if (!canAccess) return { ok: false, error: "No tienes acceso a este restaurante" };

    await prisma.restaurantOrderItem.update({
      where: { id: input.itemId },
      data: { note: input.note.trim() || null },
    });
    try {
      revalidatePath(`/app/restaurant/pos/${item.order.id}`);
    } catch {}
    return { ok: true };
  } catch (err: any) {
    if (err.code === "P2025") {
      return { ok: true, alreadyGone: true };
    }
    console.error("[pos.actions/updateItemNote] Error:", err);
    return { ok: false, error: err?.message || "No se pudo actualizar la nota" };
  }
}

/**
 * 🆕 Fase 11D / Mejorado en 11E
 *
 * Cancela un item que YA fue enviado a cocina.
 *
 * Reglas:
 * - Sólo MANAGER y arriba
 * - Motivo obligatorio (mínimo 3 caracteres)
 * - No se puede cancelar items DELIVERED (ya entregados al cliente)
 * - Guarda log en OrderItemCancellation (si existe la tabla; si no, sólo logea y borra)
 * - Elimina físicamente el item de la orden
 *
 * 🔧 11E: Ultra-resiliente. Si la tabla OrderItemCancellation NO existe (porque el
 * cliente Prisma no se regeneró o migration falló), igual borra el item y registra
 * en logs del servidor.
 */
export async function cancelOrderItem(input: {
  itemId: string;
  reason: string;
}) {
  // Wrap ABSOLUTO en try/catch para que NUNCA escale como Server Component error
  try {
    const me = await getMe();
    const role = (me as any).role as string;

    // Verificar rol
    if (!MANAGER_AND_UP.includes(role)) {
      return { ok: false, error: "Solo MANAGER y superiores pueden cancelar platillos enviados a cocina." };
    }

    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) {
      return { ok: false, error: "El motivo de cancelación es obligatorio (mínimo 3 caracteres)." };
    }

    let item;
    try {
      item = await prisma.restaurantOrderItem.findUnique({
        where: { id: input.itemId },
        include: {
          order: { select: { id: true, businessId: true, status: true } },
          menuItem: { select: { id: true, name: true } },
        },
      });
    } catch (queryErr: any) {
      console.error("[pos.actions/cancelOrderItem] Error en findUnique:", queryErr);
      return { ok: false, error: "No se pudo cargar el platillo. Intenta de nuevo." };
    }

    if (!item) {
      return { ok: true, alreadyGone: true };
    }

    if (!["OPEN", "SENT"].includes(item.order.status)) {
      return { ok: false, error: "La orden ya está cerrada y no se pueden cancelar platillos." };
    }

    if (item.kitchenStatus === "NEW") {
      return { ok: false, error: "Este platillo aún no se envía a cocina. Usa el botón de eliminar." };
    }
    if (item.kitchenStatus === "DELIVERED") {
      return { ok: false, error: "Este platillo ya fue entregado al cliente y no se puede cancelar." };
    }
    if (item.kitchenStatus === "CANCELED") {
      return { ok: true, alreadyGone: true };
    }

    let canAccess = false;
    try {
      canAccess = await userCanAccessBusiness((me as any).id, role, item.order.businessId);
    } catch (accessErr: any) {
      console.error("[pos.actions/cancelOrderItem] Error en userCanAccessBusiness:", accessErr);
    }
    if (!canAccess) {
      return { ok: false, error: "No tienes acceso a este restaurante." };
    }

    // Datos del usuario para el log
    const userId = (me as any).id;
    const userName =
      (me as any).fullName ||
      (me as any).name ||
      (me as any).username ||
      (me as any).email ||
      "Desconocido";

    // Snapshot del item para audit log
    const auditSnapshot = {
      orderId: item.order.id,
      businessId: item.order.businessId,
      menuItemId: item.menuItem?.id ?? null,
      menuItemName: item.menuItem?.name ?? "Producto eliminado",
      qty: item.qty,
      priceCents: item.priceCents,
      kitchenStatus: item.kitchenStatus,
      reason,
      canceledById: userId,
      canceledByName: userName,
    };

    // 🔧 FIX 11E: intentar guardar log, pero si la tabla no existe, NO bloquear el delete
    let auditSaved = false;
    try {
      await (prisma as any).orderItemCancellation.create({ data: auditSnapshot });
      auditSaved = true;
    } catch (auditErr: any) {
      // Posibles causas:
      // - La tabla OrderItemCancellation no existe (migration no aplicada en BD)
      // - El cliente Prisma no fue regenerado (no tiene el modelo)
      // - FK constraint del canceledById
      console.error("[pos.actions/cancelOrderItem] No se pudo guardar log de auditoría:", auditErr);
      console.error("[pos.actions/cancelOrderItem] Snapshot que se intentó guardar:", auditSnapshot);
      // Continuamos: borrar el item es más importante que el log
    }

    // 🔧 FIX 11E: Borrar el item con deleteMany (no falla si ya no existe)
    try {
      await prisma.restaurantOrderItem.deleteMany({
        where: { id: input.itemId },
      });
    } catch (deleteErr: any) {
      console.error("[pos.actions/cancelOrderItem] Error al borrar item:", deleteErr);
      return {
        ok: false,
        error: "No se pudo borrar el platillo. Contacta al administrador.",
        auditSaved,
      };
    }

    // Revalidar paths
    try {
      revalidatePath(`/app/restaurant/pos/${item.order.id}`);
      revalidatePath(`/app/kitchen`);
      revalidatePath(`/app/restaurant/tables`);
    } catch {
      // ignorar errores de revalidación
    }

    return {
      ok: true,
      auditSaved,
      canceledItem: {
        name: item.menuItem?.name ?? "Producto",
        qty: item.qty,
        priceCents: item.priceCents,
        kitchenStatus: item.kitchenStatus,
      },
    };
  } catch (err: any) {
    // 🔧 FIX 11E: capturar ABSOLUTAMENTE TODO para evitar Server Component crashes
    console.error("[pos.actions/cancelOrderItem] Error inesperado:", err);
    console.error("[pos.actions/cancelOrderItem] Stack:", err?.stack);
    return {
      ok: false,
      error: err?.message || "Error inesperado al cancelar el platillo.",
    };
  }
}

/**
 * 🆕 Fase 11D: Lista cancelaciones recientes de un negocio (para reportes).
 */
export async function listRecentCancellations(opts: {
  businessId: string;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}) {
  const me = await getMe();
  const role = (me as any).role as string;
  const ok = await userCanAccessBusiness((me as any).id, role, opts.businessId);
  if (!ok) throw new Error("No tienes acceso a este restaurante");

  const where: any = { businessId: opts.businessId };
  if (opts.fromDate || opts.toDate) {
    where.createdAt = {};
    if (opts.fromDate) where.createdAt.gte = new Date(opts.fromDate);
    if (opts.toDate) where.createdAt.lte = new Date(opts.toDate);
  }

  const cancellations = await prisma.orderItemCancellation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });

  return cancellations.map((c: any) => ({
    id: c.id,
    orderId: c.orderId,
    menuItemName: c.menuItemName,
    qty: c.qty,
    priceCents: c.priceCents,
    totalCents: c.qty * c.priceCents,
    kitchenStatus: c.kitchenStatus,
    reason: c.reason,
    canceledByName: c.canceledByName,
    createdAt: c.createdAt.toISOString(),
  }));
}

/**
 * Envía los items NEW a cocina (marca como PREPARING).
 * Cambia el estado de la orden a SENT.
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

  const newItems = order.items.filter((i: any) => i.kitchenStatus === "NEW");
  if (newItems.length === 0) {
    throw new Error("No hay items nuevos para enviar a cocina");
  }

  await prisma.$transaction([
    prisma.restaurantOrderItem.updateMany({
      where: { id: { in: newItems.map((i: any) => i.id) } },
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

  const subtotal = order.items.reduce((s: number, i: any) => s + i.qty * i.priceCents, 0);
  const tipCents = Math.max(0, input.tipCents ?? 0);
  const totalCents = subtotal + tipCents;

  const cp = await prisma.cashpoint.findUnique({ where: { id: input.cashpointId } });
  if (!cp || cp.businessId !== order.businessId) {
    throw new Error("Caja inválida para este negocio");
  }

  const concept = `Mesa ${order.table?.name ?? "?"} · Orden #${order.id.slice(-6).toUpperCase()}`;

  const newItems = order.items.filter((i: any) => i.kitchenStatus === "NEW");

  await prisma.$transaction([
    ...(newItems.length > 0
      ? [
          prisma.restaurantOrderItem.updateMany({
            where: { id: { in: newItems.map((i: any) => i.id) } },
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

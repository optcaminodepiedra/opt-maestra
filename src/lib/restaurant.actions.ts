"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { KitchenStatus, OrderStatus, PaymentMethod } from "@prisma/client";

function rv() {
  revalidatePath("/app/restaurant");
  revalidatePath("/app/restaurant/pos");
  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/kds");
  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/reports");
}

function pickDefaultCashpointId(
  cashpoints: { id: string; name: string }[],
  preferredNames: string[] = ["Restaurante", "Cantina", "Barra"]
) {
  const cps = cashpoints ?? [];
  for (const p of preferredNames) {
    const hit = cps.find((c) => (c.name || "").toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit.id;
  }
  return cps[0]?.id ?? null;
}

export async function getRestaurantBootData(input?: {
  businessId?: string;
  cashpointId?: string;
}) {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const bid = input?.businessId || businesses[0]?.id || null;
  if (!bid) {
    return {
      businesses,
      businessId: null,
      cashpoints: [],
      selectedCashpointId: null,
      tables: [],
      menu: [],
      openOrders: [],
    };
  }

  const cashpoints = await prisma.cashpoint.findMany({
    where: { businessId: bid },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedCashpointId =
    input?.cashpointId && cashpoints.some((c) => c.id === input.cashpointId)
      ? input.cashpointId
      : pickDefaultCashpointId(cashpoints);

  const tables = await prisma.restaurantTable.findMany({
    where: {
      businessId: bid,
      isActive: true,
      ...(selectedCashpointId
        ? { OR: [{ cashpointId: selectedCashpointId }, { cashpointId: null }] }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const menu = await prisma.menuItem.findMany({
    where: {
      businessId: bid,
      isActive: true,
      ...(selectedCashpointId
        ? { OR: [{ cashpointId: selectedCashpointId }, { cashpointId: null }] }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const openOrders = await prisma.restaurantOrder.findMany({
    where: { businessId: bid, status: { in: ["OPEN", "SENT", "SERVED"] } },
    orderBy: { openedAt: "desc" },
    include: {
      table: true,
      user: true,
      items: { include: { menuItem: true } },
    },
  });

  return {
    businesses,
    businessId: bid,
    cashpoints,
    selectedCashpointId,
    tables,
    menu,
    openOrders,
  };
}

export async function createTable(input: {
  businessId: string;
  cashpointId?: string | null;
  name: string;
  capacity?: number;
  area?: string;
  sortOrder?: number;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.name?.trim()) throw new Error("Falta nombre de mesa");

  await prisma.restaurantTable.create({
    data: {
      businessId: input.businessId,
      cashpointId: input.cashpointId || null,
      name: input.name.trim(),
      capacity: input.capacity ?? 4,
      area: input.area?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    },
  });

  rv();
  return true;
}

export async function createMenuItem(input: {
  businessId: string;
  cashpointId?: string | null;
  name: string;
  category: string;
  price: number; // pesos
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.name?.trim()) throw new Error("Falta nombre");
  if (!input.category?.trim()) throw new Error("Falta categoría");

  const priceCents = Math.round((input.price || 0) * 100);
  if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error("Precio inválido");

  await prisma.menuItem.create({
    data: {
      businessId: input.businessId,
      cashpointId: input.cashpointId || null,
      name: input.name.trim(),
      category: input.category.trim(),
      priceCents,
      isActive: true,
    },
  });

  rv();
  return true;
}

export async function updateMenuItem(input: {
  id: string;
  name?: string;
  category?: string;
  price?: number; // pesos
  cashpointId?: string | null;
}) {
  if (!input.id) throw new Error("Falta id");

  const data: any = {};

  if (typeof input.name === "string") {
    const v = input.name.trim();
    if (!v) throw new Error("Nombre inválido");
    data.name = v;
  }

  if (typeof input.category === "string") {
    const v = input.category.trim();
    if (!v) throw new Error("Categoría inválida");
    data.category = v;
  }

  if (typeof input.price === "number") {
    const priceCents = Math.round((input.price || 0) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error("Precio inválido");
    data.priceCents = priceCents;
  }

  if (input.cashpointId !== undefined) {
    data.cashpointId = input.cashpointId || null;
  }

  await prisma.menuItem.update({
    where: { id: input.id },
    data,
  });

  rv();
  return true;
}

export async function deleteMenuItem(input: { id: string }) {
  if (!input.id) throw new Error("Falta id");
  await prisma.menuItem.update({
    where: { id: input.id },
    data: { isActive: false },
  });
  rv();
  return true;
}

/**
 * Renombrar categoría (no destructivo)
 * Opcional: por cashpointId (si lo pasas, solo renombra items de ese cashpoint y los GENERAL null)
 */
export async function renameCategory(input: {
  businessId: string;
  cashpointId?: string | null;
  from: string;
  to: string;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  const from = (input.from || "").trim();
  const to = (input.to || "").trim();
  if (!from) throw new Error("Falta categoría origen");
  if (!to) throw new Error("Falta categoría destino");

  const where: any = {
    businessId: input.businessId,
    isActive: true,
    category: from,
  };

  if (input.cashpointId) {
    where.OR = [{ cashpointId: input.cashpointId }, { cashpointId: null }];
  }

  await prisma.menuItem.updateMany({
    where,
    data: { category: to },
  });

  rv();
  return true;
}

/**
 * Quitar categoría = desactivar todos los productos de esa categoría (no destructivo)
 */
export async function deleteCategory(input: {
  businessId: string;
  cashpointId?: string | null;
  category: string;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  const cat = (input.category || "").trim();
  if (!cat) throw new Error("Falta categoría");

  const where: any = {
    businessId: input.businessId,
    isActive: true,
    category: cat,
  };

  if (input.cashpointId) {
    where.OR = [{ cashpointId: input.cashpointId }, { cashpointId: null }];
  }

  await prisma.menuItem.updateMany({
    where,
    data: { isActive: false },
  });

  rv();
  return true;
}

export async function openOrder(input: {
  businessId: string;
  tableId: string;
  userId: string;
  note?: string | null;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.tableId) throw new Error("Falta mesa");
  if (!input.userId) throw new Error("Falta usuario");

  const existing = await prisma.restaurantOrder.findFirst({
    where: { tableId: input.tableId, status: { in: ["OPEN", "SENT", "SERVED"] } },
  });
  if (existing) {
    rv();
    return existing.id;
  }

  const o = await prisma.restaurantOrder.create({
    data: {
      businessId: input.businessId,
      tableId: input.tableId,
      userId: input.userId,
      status: OrderStatus.OPEN,
      note: input.note?.trim() || null,
    },
  });

  rv();
  return o.id;
}

export async function getOpenOrderByTable(input: { tableId: string }) {
  if (!input.tableId) return null;

  return prisma.restaurantOrder.findFirst({
    where: { tableId: input.tableId, status: { in: ["OPEN", "SENT", "SERVED"] } },
    orderBy: { openedAt: "desc" },
    include: {
      table: true,
      user: true,
      items: { include: { menuItem: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export async function addItemToOrder(input: {
  orderId: string;
  menuItemId: string;
  qty: number;
  note?: string;
}) {
  if (!input.orderId) throw new Error("Falta orden");
  if (!input.menuItemId) throw new Error("Falta producto");
  const qty = Math.max(1, Math.floor(input.qty || 1));

  const menu = await prisma.menuItem.findUnique({ where: { id: input.menuItemId } });
  if (!menu) throw new Error("Producto no existe");

  await prisma.restaurantOrderItem.create({
    data: {
      orderId: input.orderId,
      menuItemId: input.menuItemId,
      qty,
      priceCents: menu.priceCents,
      note: input.note?.trim() || null,
      kitchenStatus: KitchenStatus.NEW,
    },
  });

  rv();
  return true;
}

export async function updateOrderItemQty(input: { itemId: string; qty: number }) {
  const qty = Math.max(0, Math.floor(input.qty || 0));
  if (!input.itemId) throw new Error("Falta item");

  if (qty === 0) {
    await prisma.restaurantOrderItem.delete({ where: { id: input.itemId } });
    rv();
    return true;
  }

  await prisma.restaurantOrderItem.update({
    where: { id: input.itemId },
    data: { qty },
  });

  rv();
  return true;
}

export async function sendOrderToKitchen(orderId: string) {
  if (!orderId) throw new Error("Falta orden");

  await prisma.restaurantOrder.update({
    where: { id: orderId },
    data: { status: OrderStatus.SENT },
  });

  rv();
  return true;
}

export async function setKitchenStatus(itemId: string, status: KitchenStatus) {
  await prisma.restaurantOrderItem.update({
    where: { id: itemId },
    data: { kitchenStatus: status },
  });

  rv();
  return true;
}

export async function closeOrderAsPaidAndCreateSale(input: {
  orderId: string;
  businessId: string;
  userId: string;
  cashpointId: string;
  method: PaymentMethod;
  concept: string;
}) {
  if (!input.orderId) throw new Error("Falta orden");
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.userId) throw new Error("Falta usuario");
  if (!input.cashpointId) throw new Error("Falta caja/punto");

  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Orden no existe");

  const totalCents = (order.items || []).reduce((sum, it) => sum + it.priceCents * it.qty, 0);
  if (totalCents <= 0) throw new Error("Orden sin items");

  await prisma.$transaction([
    prisma.restaurantOrder.update({
      where: { id: input.orderId },
      data: { status: OrderStatus.PAID, closedAt: new Date() },
    }),
    prisma.sale.create({
      data: {
        businessId: input.businessId,
        cashpointId: input.cashpointId,
        userId: input.userId,
        amountCents: totalCents,
        method: input.method,
        concept: input.concept || "POS Restaurante",
      },
    }),
  ]);

  rv();
  return true;
}

export async function getKdsItems(businessId: string) {
  return prisma.restaurantOrderItem.findMany({
    where: {
      order: { businessId, status: { in: ["OPEN", "SENT", "SERVED"] } },
      kitchenStatus: { in: ["NEW", "PREPARING", "READY"] },
    },
    orderBy: [{ kitchenStatus: "asc" }, { createdAt: "asc" }],
    include: {
      menuItem: true,
      order: { include: { table: true, user: true } },
    },
  });
}

/**
 * REPORTES: Top productos vendidos (por rango)
 * Usa órdenes pagadas (status=PAID) y closedAt dentro del rango.
 */
export async function getRestaurantSalesReport(input: {
  businessId: string;
  fromISO: string; // YYYY-MM-DD
  toISO: string; // YYYY-MM-DD (inclusive)
  cashpointId?: string | null;
  limit?: number;
}) {
  if (!input.businessId) throw new Error("Falta unidad");
  if (!input.fromISO || !input.toISO) throw new Error("Faltan fechas");

  const from = new Date(`${input.fromISO}T00:00:00.000`);
  const to = new Date(`${input.toISO}T23:59:59.999`);

  const limit = Math.max(1, Math.min(100, input.limit ?? 25));

  // SQLite-friendly query (prisma dev.db)
  const rows: Array<{
    menuItemId: string;
    name: string;
    category: string;
    qty: number;
    revenueCents: number;
  }> = await prisma.$queryRaw`
    SELECT
      i.menuItemId as menuItemId,
      m.name as name,
      m.category as category,
      SUM(i.qty) as qty,
      SUM(i.qty * i.priceCents) as revenueCents
    FROM RestaurantOrderItem i
    JOIN RestaurantOrder o ON o.id = i.orderId
    JOIN MenuItem m ON m.id = i.menuItemId
    WHERE
      o.businessId = ${input.businessId}
      AND o.status = 'PAID'
      AND o.closedAt IS NOT NULL
      AND o.closedAt >= ${from}
      AND o.closedAt <= ${to}
      ${input.cashpointId ? prisma.$queryRaw`AND (m.cashpointId = ${input.cashpointId} OR m.cashpointId IS NULL)` : prisma.$queryRaw``}
    GROUP BY i.menuItemId, m.name, m.category
    ORDER BY revenueCents DESC
    LIMIT ${limit}
  `;

  const totalOrders = await prisma.restaurantOrder.count({
    where: {
      businessId: input.businessId,
      status: "PAID",
      closedAt: { gte: from, lte: to },
    },
  });

  return {
    fromISO: input.fromISO,
    toISO: input.toISO,
    totalOrders,
    topItems: rows.map((r) => ({
      ...r,
      qty: Number(r.qty || 0),
      revenueCents: Number(r.revenueCents || 0),
    })),
  };
}

// =========================
// REPORTES RESTAURANTE (PRO)
// =========================
export async function getRestaurantReportsData(input: {
  businessId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  cashpointId?: string | null;
}) {
  if (!input.businessId) throw new Error("Falta businessId");
  if (!input.from || !input.to) throw new Error("Falta rango de fechas");

  // rango inclusivo (from 00:00:00) a (to 23:59:59.999)
  const fromDate = new Date(`${input.from}T00:00:00.000`);
  const toDate = new Date(`${input.to}T23:59:59.999`);

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, name: true },
  });

  const cashpoints = await prisma.cashpoint.findMany({
    where: { businessId: input.businessId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // 1) Ventas contables (Sale)
  // OJO: tus ventas POS se insertan en Sale al cerrar orden (closeOrderAsPaidAndCreateSale)
  const sales = await prisma.sale.findMany({
    where: {
      businessId: input.businessId,
      ...(input.cashpointId ? { cashpointId: input.cashpointId } : {}),
      createdAt: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      amountCents: true,
      createdAt: true,
      cashpointId: true,
      method: true,
      concept: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // 2) Órdenes pagadas + items (para top productos/categorías)
  const orders = await prisma.restaurantOrder.findMany({
    where: {
      businessId: input.businessId,
      status: "PAID",
      closedAt: { gte: fromDate, lte: toDate },
    },
    select: {
      id: true,
      closedAt: true,
      tableId: true,
      items: {
        select: {
          qty: true,
          priceCents: true,
          menuItem: { select: { id: true, name: true, category: true, cashpointId: true } },
        },
      },
    },
    orderBy: { closedAt: "asc" },
  });

  // ====== KPIs ======
  const totalSalesCents = sales.reduce((s, x) => s + (x.amountCents || 0), 0);
  const ordersCount = orders.length;

  let itemsCount = 0;
  let itemsRevenueCents = 0;

  // Top productos (qty y revenue)
  const byProduct: Record<
    string,
    { id: string; name: string; category: string; qty: number; revenueCents: number }
  > = {};

  // Ventas por categoría
  const byCategory: Record<string, { category: string; qty: number; revenueCents: number }> = {};

  // Ventas por cashpoint (desde Sale)
  const cashpointNameById = new Map<string, string>(cashpoints.map((c) => [c.id, c.name]));
  const byCashpoint: Record<string, { cashpointId: string | null; name: string; revenueCents: number; count: number }> = {};

  // Ventas por día (desde Sale)
  const byDay: Record<string, { day: string; revenueCents: number; count: number }> = {};

  for (const o of orders) {
    for (const it of o.items) {
      const qty = it.qty || 0;
      const rev = (it.priceCents || 0) * qty;

      itemsCount += qty;
      itemsRevenueCents += rev;

      const p = it.menuItem;
      const pid = p?.id || "unknown";
      const pname = p?.name || "Sin nombre";
      const pcat = p?.category || "General";

      if (!byProduct[pid]) {
        byProduct[pid] = { id: pid, name: pname, category: pcat, qty: 0, revenueCents: 0 };
      }
      byProduct[pid].qty += qty;
      byProduct[pid].revenueCents += rev;

      if (!byCategory[pcat]) {
        byCategory[pcat] = { category: pcat, qty: 0, revenueCents: 0 };
      }
      byCategory[pcat].qty += qty;
      byCategory[pcat].revenueCents += rev;
    }
  }

  for (const s of sales) {
    const day = s.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!byDay[day]) byDay[day] = { day, revenueCents: 0, count: 0 };
    byDay[day].revenueCents += s.amountCents || 0;
    byDay[day].count += 1;

    const cpId = s.cashpointId || null;
    const name = cpId ? cashpointNameById.get(cpId) || "Caja/Local" : "General";
    const key = cpId || "GENERAL";
    if (!byCashpoint[key]) byCashpoint[key] = { cashpointId: cpId, name, revenueCents: 0, count: 0 };
    byCashpoint[key].revenueCents += s.amountCents || 0;
    byCashpoint[key].count += 1;
  }

  const topProductsByQty = Object.values(byProduct)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 20);

  const topProductsByRevenue = Object.values(byProduct)
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 20);

  const categories = Object.values(byCategory).sort((a, b) => b.revenueCents - a.revenueCents);

  const days = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));

  const cashpointsBreakdown = Object.values(byCashpoint).sort((a, b) => b.revenueCents - a.revenueCents);

  const avgTicketCents = sales.length ? Math.round(totalSalesCents / sales.length) : 0;

  return {
    business: business || { id: input.businessId, name: "Unidad" },
    cashpoints,
    range: { from: input.from, to: input.to, cashpointId: input.cashpointId || null },

    kpis: {
      totalSalesCents,
      salesCount: sales.length,
      ordersCount,
      avgTicketCents,
      itemsCount,
      itemsRevenueCents,
    },

    topProductsByQty,
    topProductsByRevenue,
    categories,
    days,
    cashpointsBreakdown,
  };
}
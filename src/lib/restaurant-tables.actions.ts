"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

const CONFIG_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "MANAGER_OPS", "MANAGER_RESTAURANT"];

async function assertCanManageRestaurant(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!CONFIG_ROLES.includes(role)) {
    throw new Error("No tienes permisos para administrar mesas.");
  }
  // Validar acceso al negocio (usa helper centralizado)
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("No tienes acceso a este negocio.");
  return me;
}

/**
 * Valida que el usuario actual tiene acceso al negocio.
 * Usado en operaciones de venta (no admin).
 */
async function assertCanOperate(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("No tienes acceso a este negocio.");
  return me;
}

/* ════════════════════════════════════════════════════════════════
 * Cargar layout completo (mesas + áreas + estado)
 * ════════════════════════════════════════════════════════════════ */

export async function getRestaurantLayout(businessId: string) {
  // Verificar acceso del usuario actual
  await assertCanOperate(businessId);

  const [tables, areasRaw] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { businessId, isActive: true },
      include: {
        orders: {
          where: { status: { in: ["OPEN", "SENT"] } },
          include: {
            user: { select: { id: true, fullName: true } },
            items: {
              select: { id: true, qty: true, priceCents: true, kitchenStatus: true },
            },
          },
          orderBy: { openedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ area: "asc" }, { sortOrder: "asc" }],
    }),
    // Las áreas pueden no tener relación en Prisma generate por timing → query raw
    prisma.$queryRaw<Array<{
      id: string;
      name: string;
      posX: number;
      posY: number;
      width: number;
      height: number;
      color: string;
      showBorder: boolean;
      sortOrder: number;
    }>>`
      SELECT id, name, "posX", "posY", width, height, color, "showBorder", "sortOrder"
      FROM "RestaurantArea"
      WHERE "businessId" = ${businessId}
      ORDER BY "sortOrder" ASC
    `,
  ]);

  const now = new Date();

  const tablesEnriched = tables.map((t) => {
    const activeOrder = t.orders[0];
    let status: "FREE" | "OCCUPIED" | "READY_TO_BILL" = "FREE";
    let totalCents = 0;
    let minutesElapsed = 0;
    let mesero: string | null = null;
    let itemCount = 0;
    let pendingKitchen = 0;

    if (activeOrder) {
      mesero = activeOrder.user?.fullName ?? null;
      itemCount = activeOrder.items.length;
      pendingKitchen = activeOrder.items.filter(
        (i) => i.kitchenStatus === "NEW" || i.kitchenStatus === "PREPARING"
      ).length;
      totalCents = activeOrder.items.reduce((s, i) => s + i.qty * i.priceCents, 0);
      minutesElapsed = Math.floor(
        (now.getTime() - new Date(activeOrder.openedAt).getTime()) / 60000
      );
      status = activeOrder.status === "SENT" && pendingKitchen === 0 ? "READY_TO_BILL" : "OCCUPIED";
    }

    return {
      id: t.id,
      name: t.name,
      area: t.area,
      capacity: t.capacity,
      shape: (t as any).shape ?? "SQUARE",
      width: (t as any).width ?? 80,
      height: (t as any).height ?? 80,
      rotation: (t as any).rotation ?? 0,
      posX: t.posX ?? 0,
      posY: t.posY ?? 0,
      sortOrder: t.sortOrder,
      status,
      activeOrderId: activeOrder?.id ?? null,
      mesero,
      minutesElapsed,
      itemCount,
      pendingKitchen,
      totalCents,
    };
  });

  const summary = {
    total: tablesEnriched.length,
    free: tablesEnriched.filter((t) => t.status === "FREE").length,
    occupied: tablesEnriched.filter((t) => t.status === "OCCUPIED").length,
    readyToBill: tablesEnriched.filter((t) => t.status === "READY_TO_BILL").length,
    totalSalesOpenCents: tablesEnriched.reduce((s, t) => s + t.totalCents, 0),
  };

  return {
    tables: tablesEnriched,
    areas: areasRaw,
    summary,
  };
}

/* ════════════════════════════════════════════════════════════════
 * MESAS — CRUD
 * ════════════════════════════════════════════════════════════════ */

export async function createTable(input: {
  businessId: string;
  name: string;
  capacity: number;
  area?: string;
  shape: "SQUARE" | "ROUND" | "RECTANGLE" | "BAR";
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation?: number;
}) {
  await assertCanManageRestaurant(input.businessId);
  const trimmedName = input.name.trim();

  // Buscar si ya existe una mesa con ese nombre (activa o inactiva)
  const existing = await prisma.restaurantTable.findFirst({
    where: { businessId: input.businessId, name: trimmedName },
  });

  if (existing) {
    if (existing.isActive) {
      // Si está activa, error real (no se puede duplicar)
      throw new Error(`Ya existe una mesa con el nombre "${trimmedName}" en este restaurante.`);
    }
    // Si está inactiva → REACTIVAR y actualizar con nuevos datos
    const reactivated = await prisma.restaurantTable.update({
      where: { id: existing.id },
      data: {
        capacity: input.capacity,
        area: input.area?.trim() || null,
        shape: input.shape as any,
        posX: input.posX,
        posY: input.posY,
        width: input.width,
        height: input.height,
        rotation: input.rotation ?? 0,
        isActive: true,
      } as any,
    });
    revalidatePath("/app/restaurant/tables");
    revalidatePath("/app/restaurant/tables/manage");
    return { ok: true, id: reactivated.id, reactivated: true };
  }

  // Crear mesa nueva
  const table = await prisma.restaurantTable.create({
    data: {
      businessId: input.businessId,
      name: trimmedName,
      capacity: input.capacity,
      area: input.area?.trim() || null,
      shape: input.shape as any,
      posX: input.posX,
      posY: input.posY,
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? 0,
      isActive: true,
    } as any,
  });

  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true, id: table.id, reactivated: false };
}

export async function updateTable(input: {
  id: string;
  name?: string;
  capacity?: number;
  area?: string | null;
  shape?: "SQUARE" | "ROUND" | "RECTANGLE" | "BAR";
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  isActive?: boolean;
}) {
  const t = await prisma.restaurantTable.findUnique({
    where: { id: input.id },
    select: { businessId: true, name: true },
  });
  if (!t) throw new Error("Mesa no encontrada");

  await assertCanManageRestaurant(t.businessId);

  // Si cambia el nombre, validar unicidad (solo mesas activas)
  if (input.name && input.name !== t.name) {
    const exists = await prisma.restaurantTable.findFirst({
      where: {
        businessId: t.businessId,
        name: input.name,
        isActive: true,
        NOT: { id: input.id },
      },
    });
    if (exists) throw new Error(`Ya existe otra mesa activa con el nombre "${input.name}".`);

    // Si hay una mesa INACTIVA con ese nombre, no podemos asignarlo (constraint UNIQUE)
    const inactiveExists = await prisma.restaurantTable.findFirst({
      where: {
        businessId: t.businessId,
        name: input.name,
        isActive: false,
        NOT: { id: input.id },
      },
    });
    if (inactiveExists) {
      throw new Error(
        `El nombre "${input.name}" está reservado por una mesa inactiva con histórico. ` +
        `Pide a un admin que limpie mesas inactivas o usa otro nombre.`
      );
    }
  }

  await prisma.restaurantTable.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.area !== undefined ? { area: input.area?.trim() || null } : {}),
      ...(input.shape !== undefined ? { shape: input.shape as any } : {}),
      ...(input.posX !== undefined ? { posX: input.posX } : {}),
      ...(input.posY !== undefined ? { posY: input.posY } : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
      ...(input.rotation !== undefined ? { rotation: input.rotation } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } as any,
  });

  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true };
}

/**
 * Update rápido de posición (drag&drop), no hace revalidate para no causar re-fetch full.
 * El cliente actualiza visualmente y solo persiste al server.
 */
export async function updateTablePosition(input: { id: string; posX: number; posY: number }) {
  const t = await prisma.restaurantTable.findUnique({
    where: { id: input.id },
    select: { businessId: true },
  });
  if (!t) throw new Error("Mesa no encontrada");
  await assertCanManageRestaurant(t.businessId);

  await prisma.restaurantTable.update({
    where: { id: input.id },
    data: { posX: input.posX, posY: input.posY } as any,
  });
  return { ok: true };
}

export async function deleteTable(id: string) {
  const t = await prisma.restaurantTable.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!t) throw new Error("Mesa no encontrada");
  await assertCanManageRestaurant(t.businessId);

  if (t._count.orders > 0) {
    // No la borramos: la desactivamos para conservar histórico
    await prisma.restaurantTable.update({
      where: { id },
      data: { isActive: false },
    });
    revalidatePath("/app/restaurant/tables");
    revalidatePath("/app/restaurant/tables/manage");
    return { ok: true, deactivated: true };
  }

  await prisma.restaurantTable.delete({ where: { id } });
  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true, deactivated: false };
}

/* ════════════════════════════════════════════════════════════════
 * ÁREAS — CRUD
 * ════════════════════════════════════════════════════════════════ */

export async function createArea(input: {
  businessId: string;
  name: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  color?: string;
  showBorder?: boolean;
}) {
  await assertCanManageRestaurant(input.businessId);

  // Validar unicidad
  const exists = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "RestaurantArea"
    WHERE "businessId" = ${input.businessId} AND name = ${input.name.trim()}
    LIMIT 1
  `;
  if (exists.length > 0) {
    throw new Error(`Ya existe un área con el nombre "${input.name}".`);
  }

  const id = "area_" + Math.random().toString(36).slice(2, 18);
  const posX = input.posX ?? 50;
  const posY = input.posY ?? 50;
  const width = input.width ?? 400;
  const height = input.height ?? 300;
  const color = input.color ?? "#f1f5f9";
  const showBorder = input.showBorder ?? true;

  await prisma.$executeRaw`
    INSERT INTO "RestaurantArea"
      ("id", "businessId", "name", "posX", "posY", "width", "height", "color", "showBorder", "sortOrder", "createdAt", "updatedAt")
    VALUES
      (${id}, ${input.businessId}, ${input.name.trim()}, ${posX}, ${posY}, ${width}, ${height}, ${color}, ${showBorder}, 0, NOW(), NOW())
  `;

  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true, id };
}

export async function updateArea(input: {
  id: string;
  name?: string;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  color?: string;
  showBorder?: boolean;
}) {
  const rows = await prisma.$queryRaw<Array<{ businessId: string; name: string }>>`
    SELECT "businessId", name FROM "RestaurantArea" WHERE id = ${input.id}
  `;
  if (rows.length === 0) throw new Error("Área no encontrada");
  const area = rows[0];

  await assertCanManageRestaurant(area.businessId);

  // Si cambia nombre, validar unicidad y propagar a las mesas que usan ese área
  let nameChanged = false;
  if (input.name && input.name !== area.name) {
    const exists = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "RestaurantArea"
      WHERE "businessId" = ${area.businessId}
        AND name = ${input.name.trim()}
        AND id != ${input.id}
      LIMIT 1
    `;
    if (exists.length > 0) {
      throw new Error(`Ya existe otra área llamada "${input.name}".`);
    }
    nameChanged = true;
  }

  // Construir UPDATE dinámico
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (input.name !== undefined) { updates.push(`name = $${i++}`); values.push(input.name.trim()); }
  if (input.posX !== undefined) { updates.push(`"posX" = $${i++}`); values.push(input.posX); }
  if (input.posY !== undefined) { updates.push(`"posY" = $${i++}`); values.push(input.posY); }
  if (input.width !== undefined) { updates.push(`width = $${i++}`); values.push(input.width); }
  if (input.height !== undefined) { updates.push(`height = $${i++}`); values.push(input.height); }
  if (input.color !== undefined) { updates.push(`color = $${i++}`); values.push(input.color); }
  if (input.showBorder !== undefined) { updates.push(`"showBorder" = $${i++}`); values.push(input.showBorder); }
  updates.push(`"updatedAt" = NOW()`);

  values.push(input.id);
  const sql = `UPDATE "RestaurantArea" SET ${updates.join(", ")} WHERE id = $${i}`;

  await prisma.$executeRawUnsafe(sql, ...values);

  // Si cambió el nombre, actualizar las mesas que usaban este área
  if (nameChanged && input.name) {
    await prisma.restaurantTable.updateMany({
      where: { businessId: area.businessId, area: area.name },
      data: { area: input.name.trim() },
    });
  }

  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true };
}

export async function updateAreaPosition(input: {
  id: string;
  posX: number;
  posY: number;
}) {
  const rows = await prisma.$queryRaw<Array<{ businessId: string }>>`
    SELECT "businessId" FROM "RestaurantArea" WHERE id = ${input.id}
  `;
  if (rows.length === 0) throw new Error("Área no encontrada");
  await assertCanManageRestaurant(rows[0].businessId);

  await prisma.$executeRaw`
    UPDATE "RestaurantArea"
    SET "posX" = ${input.posX}, "posY" = ${input.posY}, "updatedAt" = NOW()
    WHERE id = ${input.id}
  `;
  return { ok: true };
}

export async function deleteArea(id: string) {
  const rows = await prisma.$queryRaw<Array<{ businessId: string; name: string }>>`
    SELECT "businessId", name FROM "RestaurantArea" WHERE id = ${id}
  `;
  if (rows.length === 0) throw new Error("Área no encontrada");
  const area = rows[0];

  await assertCanManageRestaurant(area.businessId);

  // Las mesas que estaban en esta área quedan con area = null
  await prisma.restaurantTable.updateMany({
    where: { businessId: area.businessId, area: area.name },
    data: { area: null },
  });

  await prisma.$executeRaw`DELETE FROM "RestaurantArea" WHERE id = ${id}`;

  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/restaurant/tables/manage");
  return { ok: true };
}

/* ════════════════════════════════════════════════════════════════
 * Operación: abrir orden, mover, descartar
 * ════════════════════════════════════════════════════════════════ */

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

  // Verificar que el usuario tiene acceso al negocio de esta mesa
  await assertCanOperate(table.businessId);

  const existing = await prisma.restaurantOrder.findFirst({
    where: { tableId: table.id, status: { in: ["OPEN", "SENT"] } },
  });
  if (existing) {
    throw new Error(`La mesa ${table.name} ya tiene una orden abierta.`);
  }

  const userId = input.meseroId ?? (me as any).id;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!u) throw new Error("Mesero no válido");

  const order = await prisma.restaurantOrder.create({
    data: {
      businessId: table.businessId,
      tableId: table.id,
      userId,
      status: "OPEN",
      note: input.note?.trim() || null,
    },
  });

  revalidatePath("/app/restaurant/tables");
  return { ok: true, orderId: order.id };
}

export async function getMeserosForBusiness(businessId: string) {
  // Solo verificar acceso si no es admin (admins pueden ver meseros de cualquier negocio)
  await assertCanOperate(businessId);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        in: [
          "MASTER_ADMIN", "OWNER", "SUPERIOR",
          "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH", "MANAGER",
          "STAFF_WAITER", "STAFF_BAR", "STAFF_CASHIER",
        ],
      },
    },
    select: { id: true, fullName: true, jobTitle: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.fullName,
    jobTitle: u.jobTitle,
    role: u.role,
  }));
}

export async function discardEmptyOrder(orderId: string) {
  await getMe();
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: orderId },
    include: { _count: { select: { items: true } } },
  });
  if (!order) throw new Error("Orden no encontrada");
  await assertCanOperate(order.businessId);
  if (order._count.items > 0) {
    throw new Error("No se puede descartar una orden con productos.");
  }
  await prisma.restaurantOrder.delete({ where: { id: orderId } });
  revalidatePath("/app/restaurant/tables");
  return { ok: true };
}

export async function moveOrderToTable(input: { orderId: string; newTableId: string }) {
  await getMe();
  const order = await prisma.restaurantOrder.findUnique({
    where: { id: input.orderId },
    select: { id: true, businessId: true, status: true },
  });
  if (!order) throw new Error("Orden no encontrada");
  if (!["OPEN", "SENT"].includes(order.status)) {
    throw new Error("Solo se pueden mover órdenes abiertas");
  }
  await assertCanOperate(order.businessId);

  const newTable = await prisma.restaurantTable.findUnique({
    where: { id: input.newTableId },
    select: { id: true, businessId: true, isActive: true, name: true },
  });
  if (!newTable) throw new Error("Mesa destino no encontrada");
  if (newTable.businessId !== order.businessId) {
    throw new Error("Mesa destino es de otro negocio");
  }

  const conflict = await prisma.restaurantOrder.findFirst({
    where: { tableId: newTable.id, status: { in: ["OPEN", "SENT"] } },
  });
  if (conflict) throw new Error(`Mesa ${newTable.name} ya tiene una orden abierta.`);

  await prisma.restaurantOrder.update({
    where: { id: order.id },
    data: { tableId: newTable.id },
  });
  revalidatePath("/app/restaurant/tables");
  return { ok: true };
}

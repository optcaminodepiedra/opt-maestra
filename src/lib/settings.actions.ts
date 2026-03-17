"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function rv() {
  revalidatePath("/app/owner/settings");
  revalidatePath("/app/owner/users");
  revalidatePath("/app/restaurant/pos");
  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/tables");
}

export async function getSettingsBoot(input?: { businessId?: string }) {
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedBusinessId = input?.businessId || businesses[0]?.id || null;

  const cashpoints = selectedBusinessId
    ? await prisma.cashpoint.findMany({
        where: { businessId: selectedBusinessId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, businessId: true },
      })
    : [];

  // counts para “no borrar si ya está en uso”
  const usageByCashpointId: Record<
    string,
    { sales: number; shifts: number; menuItems: number; tables: number }
  > = {};

  if (cashpoints.length) {
    const ids = cashpoints.map((c) => c.id);

    const [sales, shifts, menuItems, tables] = await Promise.all([
      prisma.sale.groupBy({
        by: ["cashpointId"],
        where: { cashpointId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.shift.groupBy({
        by: ["cashpointId"],
        where: { cashpointId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.menuItem.groupBy({
        by: ["cashpointId"],
        where: { cashpointId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.restaurantTable.groupBy({
        by: ["cashpointId"],
        where: { cashpointId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    for (const c of ids) {
      usageByCashpointId[c] = { sales: 0, shifts: 0, menuItems: 0, tables: 0 };
    }

    for (const row of sales) usageByCashpointId[row.cashpointId].sales = row._count._all;
    for (const row of shifts) usageByCashpointId[row.cashpointId].shifts = row._count._all;
    for (const row of menuItems) usageByCashpointId[row.cashpointId!].menuItems = row._count._all; // cashpointId puede ser null, aquí solo vienen ids
    for (const row of tables) usageByCashpointId[row.cashpointId!].tables = row._count._all;
  }

  return {
    businesses,
    selectedBusinessId,
    cashpoints,
    usageByCashpointId,
  };
}

export async function renameBusiness(input: { businessId: string; name: string }) {
  if (!input.businessId) throw new Error("Falta businessId");
  const name = (input.name || "").trim();
  if (!name) throw new Error("Nombre inválido");

  await prisma.business.update({
    where: { id: input.businessId },
    data: { name },
  });

  rv();
  return true;
}

export async function createCashpoint(input: { businessId: string; name: string }) {
  if (!input.businessId) throw new Error("Falta businessId");
  const name = (input.name || "").trim();
  if (!name) throw new Error("Nombre inválido");

  await prisma.cashpoint.create({
    data: { businessId: input.businessId, name },
  });

  rv();
  return true;
}

export async function renameCashpoint(input: { cashpointId: string; name: string }) {
  if (!input.cashpointId) throw new Error("Falta cashpointId");
  const name = (input.name || "").trim();
  if (!name) throw new Error("Nombre inválido");

  await prisma.cashpoint.update({
    where: { id: input.cashpointId },
    data: { name },
  });

  rv();
  return true;
}

export async function deleteCashpointSafe(input: { cashpointId: string }) {
  if (!input.cashpointId) throw new Error("Falta cashpointId");

  // No permitir borrar si ya está referenciado
  const [sales, shifts, menuItems, tables] = await Promise.all([
    prisma.sale.count({ where: { cashpointId: input.cashpointId } }),
    prisma.shift.count({ where: { cashpointId: input.cashpointId } }),
    prisma.menuItem.count({ where: { cashpointId: input.cashpointId } }),
    prisma.restaurantTable.count({ where: { cashpointId: input.cashpointId } }),
  ]);

  const totalRefs = sales + shifts + menuItems + tables;
  if (totalRefs > 0) {
    throw new Error(
      `No se puede eliminar: está en uso (ventas:${sales}, turnos:${shifts}, menu:${menuItems}, mesas:${tables}). ` +
        `Recomendado: renómbralo como "INACTIVO - ..." y deja de usarlo.`
    );
  }

  await prisma.cashpoint.delete({ where: { id: input.cashpointId } });

  rv();
  return true;
}
"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

async function assertAdmin() {
  const me = await getMe();
  if (!ADMIN_ROLES.includes(me.role as string)) {
    throw new Error("Solo administradores pueden modificar negocios.");
  }
  return me;
}

export async function createBusiness(input: {
  name: string;
  linkedHotelBusinessId?: string | null;
}) {
  await assertAdmin();
  if (!input.name.trim()) throw new Error("El nombre es requerido.");

  const business = await prisma.business.create({
    data: {
      name: input.name.trim(),
      linkedHotelBusinessId: input.linkedHotelBusinessId || null,
    },
    select: { id: true, name: true },
  });

  revalidatePath("/app/owner/businesses");
  return { ok: true, id: business.id };
}

export async function updateBusiness(input: {
  id: string;
  name: string;
  linkedHotelBusinessId?: string | null;
}) {
  await assertAdmin();
  if (!input.name.trim()) throw new Error("El nombre es requerido.");

  await prisma.business.update({
    where: { id: input.id },
    data: {
      name: input.name.trim(),
      linkedHotelBusinessId: input.linkedHotelBusinessId || null,
    },
  });

  revalidatePath("/app/owner/businesses");
  return { ok: true };
}

export async function getBusinessStats() {
  await assertAdmin();

  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      linkedHotelBusinessId: true,
      linkedHotel: { select: { name: true } },
      _count: {
        select: {
          sales: true,
          expenses: true,
          users: true,
          hotelRooms: true,
          restaurantTables: true,
          inventoryItems: true,
          cashpoints: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    linkedHotelBusinessId: b.linkedHotelBusinessId,
    linkedHotelName: b.linkedHotel?.name ?? null,
    stats: {
      sales: b._count.sales,
      expenses: b._count.expenses,
      users: b._count.users,
      hotelRooms: b._count.hotelRooms,
      restaurantTables: b._count.restaurantTables,
      inventoryItems: b._count.inventoryItems,
      cashpoints: b._count.cashpoints,
    },
  }));
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CatalogType } from "@prisma/client";

function rv() {
  revalidatePath("/app/owner/settings");
  revalidatePath("/app/owner/users");
  revalidatePath("/app/owner/reports");
  revalidatePath("/app/restaurant/pos");
  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/tables");
  revalidatePath("/app/inventory");
  revalidatePath("/app/ops");
}

// ===== helpers =====
function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

async function upsertPlatformSetting(key: string, value: string) {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getPlatformSettingsBoot(input?: { businessId?: string }) {
  // Businesses
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedBusinessId = input?.businessId || businesses[0]?.id || null;

  // Global Settings
  const settingsRows = await prisma.platformSetting.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true },
  });

  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r.key] = r.value;

  // Cashpoints for selected business (reusa lo que ya tenías)
  const cashpoints = selectedBusinessId
    ? await prisma.cashpoint.findMany({
        where: { businessId: selectedBusinessId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, businessId: true },
      })
    : [];

  // Catalogs
  const catalogs = await prisma.catalogItem.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, type: true, name: true, isActive: true, sortOrder: true },
  });

  // Business-level “modules enabled” lo vamos a guardar dentro de PlatformSetting en JSON por negocio:
  // key: BUSINESS_MODULES:<businessId> value: {"restaurant":true,"hotel":false...}
  const modulesByBusinessId: Record<string, any> = {};
  for (const b of businesses) {
    const key = `BUSINESS_MODULES:${b.id}`;
    const raw = settingsMap[key] ?? "";
    modulesByBusinessId[b.id] = safeJsonParse(raw, {
      restaurant: true,
      hotel: false,
      museum: false,
      adventure: false,
      inventory: true,
      iot: false,
      payroll: false,
      accounting: true,
    });
  }

  return {
    businesses,
    selectedBusinessId,
    cashpoints,
    settingsMap,
    modulesByBusinessId,
    catalogs,
  };
}

// ===== Global settings (Plataforma) =====
export async function setPlatformSetting(input: { key: string; value: string }) {
  const key = (input.key || "").trim();
  if (!key) throw new Error("Falta key");

  await upsertPlatformSetting(key, input.value ?? "");
  await prisma.auditLog.create({
    data: {
      action: "SET_SETTING",
      target: "PlatformSetting",
      targetId: key,
      after: String(input.value ?? ""),
    },
  }).catch(() => {});

  rv();
  return true;
}

// ===== Business modules =====
export async function setBusinessModules(input: {
  businessId: string;
  modules: {
    restaurant?: boolean;
    hotel?: boolean;
    museum?: boolean;
    adventure?: boolean;
    inventory?: boolean;
    iot?: boolean;
    payroll?: boolean;
    accounting?: boolean;
  };
}) {
  if (!input.businessId) throw new Error("Falta businessId");

  const key = `BUSINESS_MODULES:${input.businessId}`;
  const value = JSON.stringify({
    restaurant: !!input.modules.restaurant,
    hotel: !!input.modules.hotel,
    museum: !!input.modules.museum,
    adventure: !!input.modules.adventure,
    inventory: !!input.modules.inventory,
    iot: !!input.modules.iot,
    payroll: !!input.modules.payroll,
    accounting: !!input.modules.accounting,
  });

  await upsertPlatformSetting(key, value);

  await prisma.auditLog.create({
    data: {
      action: "SET_BUSINESS_MODULES",
      target: "PlatformSetting",
      targetId: key,
      after: value,
    },
  }).catch(() => {});

  rv();
  return true;
}

// ===== Catalogs =====
export async function createCatalogItem(input: {
  type: CatalogType;
  name: string;
  sortOrder?: number;
}) {
  const name = (input.name || "").trim();
  if (!name) throw new Error("Nombre inválido");

  const row = await prisma.catalogItem.create({
    data: {
      type: input.type,
      name,
      isActive: true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "ADD_CATALOG",
      target: "CatalogItem",
      targetId: row.id,
      after: JSON.stringify({ type: input.type, name }),
    },
  }).catch(() => {});

  rv();
  return true;
}

export async function updateCatalogItem(input: {
  id: string;
  name?: string;
  isActive?: boolean;
  sortOrder?: number;
}) {
  if (!input.id) throw new Error("Falta id");

  const data: any = {};
  if (typeof input.name === "string") data.name = input.name.trim();
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  if (typeof input.sortOrder === "number") data.sortOrder = input.sortOrder;

  const before = await prisma.catalogItem.findUnique({ where: { id: input.id } });

  await prisma.catalogItem.update({
    where: { id: input.id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_CATALOG",
      target: "CatalogItem",
      targetId: input.id,
      before: before ? JSON.stringify(before) : null,
      after: JSON.stringify(data),
    },
  }).catch(() => {});

  rv();
  return true;
}

export async function deleteCatalogItem(input: { id: string }) {
  if (!input.id) throw new Error("Falta id");

  const before = await prisma.catalogItem.findUnique({ where: { id: input.id } });
  await prisma.catalogItem.delete({ where: { id: input.id } });

  await prisma.auditLog.create({
    data: {
      action: "DELETE_CATALOG",
      target: "CatalogItem",
      targetId: input.id,
      before: before ? JSON.stringify(before) : null,
    },
  }).catch(() => {});

  rv();
  return true;
}
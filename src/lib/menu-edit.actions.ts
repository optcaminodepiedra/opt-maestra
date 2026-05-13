"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { userCanAccessBusiness } from "@/lib/restaurant-resolve";

const EDIT_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_RANCH",
];

async function assertCanEditMenu(businessId: string) {
  const me = await getMe();
  const role = (me as any).role as string;
  if (!EDIT_ROLES.includes(role)) throw new Error("Sin permisos para editar menú");
  const ok = await userCanAccessBusiness((me as any).id, role, businessId);
  if (!ok) throw new Error("Sin acceso a este negocio");
  return me;
}

// ═══════════════════════════════════════════════════════════════
// LECTURA
// ═══════════════════════════════════════════════════════════════

/**
 * Carga TODOS los productos del menú (activos + inactivos) con sus modificadores.
 */
export async function getMenuForEdit(businessId: string) {
  await assertCanEditMenu(businessId);

  const [items, modifierGroups] = await Promise.all([
    prisma.menuItem.findMany({
      where: { businessId },
      include: {
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                modifiers: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" } as any, { name: "asc" }],
    }),
    prisma.menuModifierGroup.findMany({
      where: { businessId },
      include: {
        modifiers: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Sacar categorías únicas
  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  return {
    items: items.map((i: any) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      priceCents: i.priceCents,
      isActive: i.isActive,
      isFeatured: i.isFeatured ?? false,
      station: i.station ?? "KITCHEN",
      sortOrder: i.sortOrder ?? 0,
      imageUrl: i.imageUrl ?? null,
      description: i.description ?? null,
      modifierGroupIds: i.modifierGroups.map((mg: any) => mg.modifierGroupId),
    })),
    modifierGroups: modifierGroups.map((mg) => ({
      id: mg.id,
      name: mg.name,
      selectionMode: mg.selectionMode,
      isRequired: mg.isRequired,
      minSelections: mg.minSelections,
      maxSelections: mg.maxSelections,
      sortOrder: mg.sortOrder,
      modifiers: mg.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        priceCents: m.priceCents,
        isDefault: m.isDefault,
        isActive: m.isActive,
        sortOrder: m.sortOrder,
      })),
    })),
    categories,
  };
}

// ═══════════════════════════════════════════════════════════════
// CRUD MENU ITEMS
// ═══════════════════════════════════════════════════════════════

export async function createMenuItem(input: {
  businessId: string;
  name: string;
  category: string;
  priceCents: number;
  station?: "KITCHEN" | "BAR" | "NONE";
  description?: string;
  imageUrl?: string;
  isFeatured?: boolean;
  modifierGroupIds?: string[];
}) {
  await assertCanEditMenu(input.businessId);

  if (!input.name.trim()) throw new Error("Nombre requerido");
  if (input.priceCents < 0) throw new Error("Precio inválido");

  const cashpoint = await prisma.cashpoint.findFirst({
    where: { businessId: input.businessId },
    select: { id: true },
  });

  const created = await prisma.menuItem.create({
    data: {
      businessId: input.businessId,
      cashpointId: cashpoint?.id ?? null,
      name: input.name.trim(),
      category: input.category.trim(),
      priceCents: input.priceCents,
      station: (input.station ?? "KITCHEN") as any,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      isFeatured: input.isFeatured ?? false,
      isActive: true,
    } as any,
  });

  // Vincular grupos de modificadores
  if (input.modifierGroupIds && input.modifierGroupIds.length > 0) {
    await prisma.menuItemModifierGroup.createMany({
      data: input.modifierGroupIds.map((gid, idx) => ({
        menuItemId: created.id,
        modifierGroupId: gid,
        sortOrder: idx,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, id: created.id };
}

export async function updateMenuItem(input: {
  id: string;
  name?: string;
  category?: string;
  priceCents?: number;
  station?: "KITCHEN" | "BAR" | "NONE";
  description?: string;
  imageUrl?: string;
  isFeatured?: boolean;
  isActive?: boolean;
  modifierGroupIds?: string[];
}) {
  const item = await prisma.menuItem.findUnique({
    where: { id: input.id },
    select: { businessId: true },
  });
  if (!item) throw new Error("Producto no encontrado");

  await assertCanEditMenu(item.businessId);

  await prisma.menuItem.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.station !== undefined ? { station: input.station as any } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl.trim() || null } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    } as any,
  });

  // Actualizar vínculos a grupos de modificadores
  if (input.modifierGroupIds !== undefined) {
    await prisma.menuItemModifierGroup.deleteMany({
      where: { menuItemId: input.id },
    });
    if (input.modifierGroupIds.length > 0) {
      await prisma.menuItemModifierGroup.createMany({
        data: input.modifierGroupIds.map((gid, idx) => ({
          menuItemId: input.id,
          modifierGroupId: gid,
          sortOrder: idx,
        })),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true };
}

export async function deleteMenuItem(itemId: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { businessId: true, name: true },
  });
  if (!item) throw new Error("Producto no encontrado");

  await assertCanEditMenu(item.businessId);

  // Verificar si tiene órdenes históricas
  const hasOrders = await prisma.restaurantOrderItem.findFirst({
    where: { menuItemId: itemId },
    select: { id: true },
  });

  if (hasOrders) {
    // Soft delete: desactivar
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
    revalidatePath("/app/restaurant/menu/edit");
    return { ok: true, deactivated: true };
  }

  // Hard delete: borrar
  await prisma.menuItem.delete({ where: { id: itemId } });

  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, deactivated: false };
}

/**
 * Duplica un producto con sufijo "(copia)".
 */
export async function duplicateMenuItem(itemId: string) {
  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { modifierGroups: { select: { modifierGroupId: true, sortOrder: true } } },
  });
  if (!item) throw new Error("Producto no encontrado");

  await assertCanEditMenu(item.businessId);

  const created = await prisma.menuItem.create({
    data: {
      businessId: item.businessId,
      cashpointId: item.cashpointId,
      name: `${item.name} (copia)`,
      category: item.category,
      priceCents: item.priceCents,
      station: (item as any).station,
      description: (item as any).description,
      imageUrl: (item as any).imageUrl,
      isFeatured: (item as any).isFeatured ?? false,
      isActive: true,
    } as any,
  });

  // Copiar vínculos a modificadores
  if (item.modifierGroups.length > 0) {
    await prisma.menuItemModifierGroup.createMany({
      data: item.modifierGroups.map((mg) => ({
        menuItemId: created.id,
        modifierGroupId: mg.modifierGroupId,
        sortOrder: mg.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, id: created.id };
}

// ═══════════════════════════════════════════════════════════════
// ACCIONES MASIVAS
// ═══════════════════════════════════════════════════════════════

/**
 * Aplica una acción masiva a varios productos.
 * Operaciones soportadas:
 *   - activate / deactivate
 *   - changePrice: { mode: 'percent' | 'fixed', value: number }
 *     percent: positivo = subir, negativo = bajar (ej: 10 = +10%, -5 = -5%)
 *     fixed: aplicar precio fijo
 *   - changeCategory: { newCategory: string }
 *   - changeStation: { station: 'KITCHEN' | 'BAR' | 'NONE' }
 */
export async function bulkUpdateMenuItems(input: {
  businessId: string;
  itemIds: string[];
  operation:
    | { type: "activate" }
    | { type: "deactivate" }
    | { type: "delete" }
    | { type: "changePrice"; mode: "percent" | "fixed" | "delta"; value: number }
    | { type: "changeCategory"; newCategory: string }
    | { type: "changeStation"; station: "KITCHEN" | "BAR" | "NONE" };
}) {
  await assertCanEditMenu(input.businessId);

  if (input.itemIds.length === 0) throw new Error("Selecciona al menos un producto");

  // Validar que todos los items pertenecen al business
  const items = await prisma.menuItem.findMany({
    where: { id: { in: input.itemIds }, businessId: input.businessId },
    select: { id: true, priceCents: true },
  });
  if (items.length !== input.itemIds.length) {
    throw new Error("Algunos productos no pertenecen a este restaurante");
  }

  const op = input.operation;
  let updated = 0;

  switch (op.type) {
    case "activate": {
      const result = await prisma.menuItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: { isActive: true },
      });
      updated = result.count;
      break;
    }
    case "deactivate": {
      const result = await prisma.menuItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: { isActive: false },
      });
      updated = result.count;
      break;
    }
    case "delete": {
      // Borrar solo los que no tienen órdenes; desactivar los demás
      const idsWithOrders = await prisma.restaurantOrderItem.findMany({
        where: { menuItemId: { in: input.itemIds } },
        select: { menuItemId: true },
        distinct: ["menuItemId"],
      });
      const lockedIds = new Set(idsWithOrders.map((x) => x.menuItemId));
      const safeToDelete = input.itemIds.filter((id) => !lockedIds.has(id));
      const toDeactivate = input.itemIds.filter((id) => lockedIds.has(id));

      if (safeToDelete.length > 0) {
        await prisma.menuItem.deleteMany({ where: { id: { in: safeToDelete } } });
      }
      if (toDeactivate.length > 0) {
        await prisma.menuItem.updateMany({
          where: { id: { in: toDeactivate } },
          data: { isActive: false },
        });
      }
      updated = input.itemIds.length;
      break;
    }
    case "changePrice": {
      // Procesar uno por uno para % y delta
      if (op.mode === "fixed") {
        const result = await prisma.menuItem.updateMany({
          where: { id: { in: input.itemIds } },
          data: { priceCents: Math.max(0, Math.round(op.value)) },
        });
        updated = result.count;
      } else {
        for (const item of items) {
          let newPrice = item.priceCents;
          if (op.mode === "percent") {
            newPrice = Math.round(item.priceCents * (1 + op.value / 100));
          } else if (op.mode === "delta") {
            newPrice = item.priceCents + Math.round(op.value);
          }
          newPrice = Math.max(0, newPrice);
          await prisma.menuItem.update({
            where: { id: item.id },
            data: { priceCents: newPrice },
          });
          updated++;
        }
      }
      break;
    }
    case "changeCategory": {
      const result = await prisma.menuItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: { category: op.newCategory.trim() },
      });
      updated = result.count;
      break;
    }
    case "changeStation": {
      const result = await prisma.menuItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: { station: op.station as any } as any,
      });
      updated = result.count;
      break;
    }
  }

  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, updated };
}

// ═══════════════════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════════════════

export async function renameCategory(input: {
  businessId: string;
  oldName: string;
  newName: string;
}) {
  await assertCanEditMenu(input.businessId);

  if (!input.newName.trim()) throw new Error("Nombre de categoría inválido");
  if (input.oldName === input.newName.trim()) return { ok: true, updated: 0 };

  const result = await prisma.menuItem.updateMany({
    where: { businessId: input.businessId, category: input.oldName },
    data: { category: input.newName.trim() },
  });

  revalidatePath("/app/restaurant/menu");
  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, updated: result.count };
}

// ═══════════════════════════════════════════════════════════════
// GRUPOS DE MODIFICADORES
// ═══════════════════════════════════════════════════════════════

export async function createModifierGroup(input: {
  businessId: string;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  minSelections?: number;
  maxSelections?: number | null;
}) {
  await assertCanEditMenu(input.businessId);

  const group = await prisma.menuModifierGroup.create({
    data: {
      businessId: input.businessId,
      name: input.name.trim(),
      selectionMode: input.selectionMode,
      isRequired: input.isRequired,
      minSelections: input.minSelections ?? 0,
      maxSelections: input.maxSelections ?? null,
    },
  });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, id: group.id };
}

export async function updateModifierGroup(input: {
  id: string;
  name?: string;
  selectionMode?: "SINGLE" | "MULTIPLE";
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
}) {
  const g = await prisma.menuModifierGroup.findUnique({
    where: { id: input.id },
    select: { businessId: true },
  });
  if (!g) throw new Error("Grupo no encontrado");

  await assertCanEditMenu(g.businessId);

  await prisma.menuModifierGroup.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.selectionMode !== undefined ? { selectionMode: input.selectionMode } : {}),
      ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
      ...(input.minSelections !== undefined ? { minSelections: input.minSelections } : {}),
      ...(input.maxSelections !== undefined ? { maxSelections: input.maxSelections } : {}),
    },
  });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true };
}

export async function deleteModifierGroup(groupId: string) {
  const g = await prisma.menuModifierGroup.findUnique({
    where: { id: groupId },
    select: { businessId: true },
  });
  if (!g) throw new Error("Grupo no encontrado");

  await assertCanEditMenu(g.businessId);

  await prisma.menuModifierGroup.delete({ where: { id: groupId } });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// MODIFICADORES INDIVIDUALES
// ═══════════════════════════════════════════════════════════════

export async function createModifier(input: {
  groupId: string;
  name: string;
  priceCents?: number;
  isDefault?: boolean;
}) {
  const g = await prisma.menuModifierGroup.findUnique({
    where: { id: input.groupId },
    select: { businessId: true },
  });
  if (!g) throw new Error("Grupo no encontrado");

  await assertCanEditMenu(g.businessId);

  const m = await prisma.menuModifier.create({
    data: {
      groupId: input.groupId,
      name: input.name.trim(),
      priceCents: input.priceCents ?? 0,
      isDefault: input.isDefault ?? false,
      isActive: true,
    },
  });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true, id: m.id };
}

export async function updateModifier(input: {
  id: string;
  name?: string;
  priceCents?: number;
  isDefault?: boolean;
  isActive?: boolean;
}) {
  const m = await prisma.menuModifier.findUnique({
    where: { id: input.id },
    include: { group: { select: { businessId: true } } },
  });
  if (!m) throw new Error("Modificador no encontrado");

  await assertCanEditMenu(m.group.businessId);

  await prisma.menuModifier.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true };
}

export async function deleteModifier(modifierId: string) {
  const m = await prisma.menuModifier.findUnique({
    where: { id: modifierId },
    include: { group: { select: { businessId: true } } },
  });
  if (!m) throw new Error("Modificador no encontrado");

  await assertCanEditMenu(m.group.businessId);

  await prisma.menuModifier.delete({ where: { id: modifierId } });

  revalidatePath("/app/restaurant/menu/edit");
  return { ok: true };
}

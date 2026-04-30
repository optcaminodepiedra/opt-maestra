"use server";

import { prisma } from "@/lib/prisma";
import { getMe, isManager } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { notifyRole, notifyUser } from "@/lib/notifications.actions";
import { createAccountsPayable } from "@/lib/accounts-payable.actions";

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const MANAGER_ROLES = ["MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER"];
const INVENTORY_ROLES = ["INVENTORY"];

/* ═══════════════════════════ Reglas de tipo según rol ═══════════════════════════ */

function allowedKindsForRole(role: string): string[] {
  if (GLOBAL_ROLES.includes(role)) {
    return ["RESTAURANT", "SPECIAL_EVENT", "OWNER_HOUSE", "VENDING_MACHINE", "GENERAL"];
  }
  if (INVENTORY_ROLES.includes(role)) {
    return ["RESTAURANT", "SPECIAL_EVENT", "OWNER_HOUSE", "VENDING_MACHINE", "GENERAL"];
  }
  if (MANAGER_ROLES.includes(role)) {
    return ["RESTAURANT", "SPECIAL_EVENT"];
  }
  return [];
}

/* ═══════════════════════════ Helpers ═══════════════════════════ */

async function assertCanCreateRequisition(businessId: string, kind: string) {
  const me = await getMe();
  const role = me.role as string;

  const allowed = allowedKindsForRole(role);
  if (!allowed.includes(kind)) {
    throw new Error(`Tu rol no puede crear requisiciones de tipo ${kind}.`);
  }

  // OWNER_HOUSE y VENDING_MACHINE no requieren businessId estrictamente
  // RESTAURANT y SPECIAL_EVENT sí lo requieren
  if (["RESTAURANT", "SPECIAL_EVENT"].includes(kind)) {
    // Validar acceso al negocio
    if (GLOBAL_ROLES.includes(role) || INVENTORY_ROLES.includes(role)) return me;
    if ((me as any).primaryBusinessId === businessId) return me;
    try {
      const access = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "UserBusinessAccess"
        WHERE "userId" = ${(me as any).id} AND "businessId" = ${businessId}
        LIMIT 1
      `;
      if (access.length > 0) return me;
    } catch {}
    throw new Error("No tienes acceso a ese negocio.");
  }

  return me;
}

/* ═══════════════════════════ Crear requisición ═══════════════════════════ */

export type RequisitionItemInput =
  | {
      // Item del catálogo
      itemId: string;
      qtyRequested: number;
      note?: string;
      estimatedPriceCents?: number;
    }
  | {
      // Producto libre (no en catálogo)
      freeTextName: string;
      freeTextUnit: string;
      qtyRequested: number;
      note?: string;
      estimatedPriceCents?: number;
    };

export type CreateRequisitionInput = {
  businessId: string;
  kind: "RESTAURANT" | "SPECIAL_EVENT" | "OWNER_HOUSE" | "VENDING_MACHINE" | "GENERAL";
  title: string;
  eventName?: string;          // para SPECIAL_EVENT
  isPrivate?: boolean;         // OWNER_HOUSE = true automático
  priority?: "NORMAL" | "URGENT";
  urgentNote?: string;         // requerido si priority = URGENT
  requiresSeparatePayment?: boolean;
  note?: string;
  neededByIso?: string;
  items: RequisitionItemInput[];
};

export async function createRequisition(input: CreateRequisitionInput) {
  const me = await assertCanCreateRequisition(input.businessId, input.kind);
  const role = me.role as string;

  if (!input.title?.trim()) throw new Error("Falta el título.");
  if (!input.items || input.items.length === 0) {
    throw new Error("Agrega al menos un producto.");
  }

  // Reglas según tipo
  if (input.kind === "SPECIAL_EVENT" && !input.eventName?.trim()) {
    throw new Error("Las requisiciones especiales requieren nombre del evento.");
  }

  // Prioridad URGENT requiere nota
  if (input.priority === "URGENT" && !input.urgentNote?.trim()) {
    throw new Error("Las requisiciones URGENTES requieren explicar por qué.");
  }

  // OWNER_HOUSE siempre es privada
  const isPrivate = input.kind === "OWNER_HOUSE" ? true : input.isPrivate ?? false;

  // Validar items
  const itemsCatalogIds = input.items
    .filter((i): i is Extract<RequisitionItemInput, { itemId: string }> => "itemId" in i)
    .map((i) => i.itemId);

  // Para RESTAURANT, todos los items DEBEN ser del catálogo
  if (input.kind === "RESTAURANT") {
    const hasFreeText = input.items.some((i) => "freeTextName" in i);
    if (hasFreeText) {
      throw new Error("Las requisiciones de restaurante solo permiten productos del catálogo. Para productos libres usa SPECIAL_EVENT.");
    }
  }

  // Validar que los items del catálogo existen y pertenecen al negocio
  if (itemsCatalogIds.length > 0) {
    const valid = await prisma.inventoryItem.findMany({
      where: { id: { in: itemsCatalogIds }, businessId: input.businessId },
      select: { id: true, lastPriceCents: true },
    });
    if (valid.length !== itemsCatalogIds.length) {
      throw new Error("Algún producto no pertenece a este negocio.");
    }
    var priceMap = new Map(valid.map((v) => [v.id, v.lastPriceCents]));
  } else {
    var priceMap = new Map();
  }

  // Validar cantidades > 0
  for (const line of input.items) {
    if (line.qtyRequested <= 0) throw new Error("Las cantidades deben ser mayores a 0.");
    if ("freeTextName" in line) {
      if (!line.freeTextName.trim()) throw new Error("Falta el nombre del producto libre.");
      if (!line.freeTextUnit.trim()) throw new Error("Falta la unidad del producto libre.");
    }
  }

  // Crear la requisición y sus items en una transacción
  const requisition = await prisma.requisition.create({
    data: {
      businessId: input.businessId,
      title: input.title.trim(),
      kind: input.kind,
      eventName: input.kind === "SPECIAL_EVENT" ? input.eventName?.trim() : null,
      isPrivate,
      priority: input.priority ?? "NORMAL",
      urgentNote: input.priority === "URGENT" ? input.urgentNote?.trim() : null,
      requiresSeparatePayment: input.requiresSeparatePayment ?? false,
      note: input.note?.trim() || null,
      neededBy: input.neededByIso ? new Date(input.neededByIso + "T00:00:00.000Z") : null,
      status: "SUBMITTED",
      createdById: (me as any).id,
      items: {
        create: input.items.map((line) => {
          if ("itemId" in line) {
            return {
              itemId: line.itemId,
              qtyRequested: line.qtyRequested,
              note: line.note?.trim() || null,
              estimatedPriceCents: line.estimatedPriceCents ?? priceMap.get(line.itemId) ?? 0,
            };
          } else {
            return {
              itemId: null,
              freeTextName: line.freeTextName.trim(),
              freeTextUnit: line.freeTextUnit.trim(),
              qtyRequested: line.qtyRequested,
              note: line.note?.trim() || null,
              estimatedPriceCents: line.estimatedPriceCents ?? 0,
            };
          }
        }),
      },
    },
    select: { id: true, title: true, kind: true, isPrivate: true },
  });

  // Notificar a Goyo (rol INVENTORY) que hay una nueva requisición
  // Excepto OWNER_HOUSE — esa solo la ve Goyo cuando entra
  await notifyRole({
    role: "INVENTORY",
    type: "REQUISITION_NEW",
    title: input.priority === "URGENT" ? "🚨 Nueva requisición URGENTE" : "Nueva requisición",
    message: `${requisition.title} (${requisition.kind})`,
    linkUrl: `/app/inventory/requisitions/${requisition.id}`,
    relatedEntityId: requisition.id,
    relatedEntityType: "Requisition",
  });

  revalidatePath("/app/inventory/requisitions");
  revalidatePath("/app/manager/ops/requisitions");
  revalidatePath("/app/manager/restaurant/requisitions");
  revalidatePath("/app/manager/ranch/requisitions");
  return { ok: true, requisitionId: requisition.id };
}

/* ═══════════════════════════ Aprobar requisición ═══════════════════════════ */

export async function approveRequisition(input: {
  requisitionId: string;
  note?: string;
}) {
  const me = await getMe();
  const role = me.role as string;

  if (![...GLOBAL_ROLES, ...INVENTORY_ROLES].includes(role)) {
    throw new Error("Sin permisos para aprobar requisiciones.");
  }

  const req = await prisma.requisition.findUnique({
    where: { id: input.requisitionId },
    include: {
      items: true,
      createdBy: { select: { id: true } },
      business: { select: { name: true } },
    },
  });
  if (!req) throw new Error("Requisición no encontrada.");
  if (req.status !== "SUBMITTED" && req.status !== "DRAFT") {
    throw new Error(`No se puede aprobar (estado actual: ${req.status}).`);
  }

  // Calcular monto total estimado
  const totalCents = req.items.reduce(
    (sum, it) => sum + it.qtyRequested * it.estimatedPriceCents,
    0
  );

  await prisma.requisition.update({
    where: { id: input.requisitionId },
    data: {
      status: "APPROVED",
      note: input.note ? `${req.note ?? ""}\nAprobada: ${input.note}`.trim() : req.note,
    },
  });

  // Si requiere pago aparte, crear AccountsPayable automáticamente
  if (req.requiresSeparatePayment && totalCents > 0) {
    try {
      await createAccountsPayable({
        businessId: req.businessId,
        requisitionId: req.id,
        supplierName: "Por definir", // se llena cuando contadora ve la requisición
        concept: `Req. ${req.title}${req.eventName ? ` (${req.eventName})` : ""}`,
        amountCents: totalCents,
        isUrgent: req.priority === "URGENT",
        note: `Generado desde requisición ${req.kind}`,
      });
    } catch (err) {
      console.error("No se pudo crear AccountsPayable:", err);
    }
  }

  // Notificar al gerente que pidió
  await notifyUser({
    userId: req.createdBy.id,
    type: "REQUISITION_APPROVED",
    title: "Tu requisición fue aprobada",
    message: req.title,
    linkUrl: `/app/inventory/requisitions/${req.id}`,
    relatedEntityId: req.id,
    relatedEntityType: "Requisition",
  });

  revalidatePath("/app/inventory/requisitions");
  return { ok: true };
}

/* ═══════════════════════════ Rechazar requisición ═══════════════════════════ */

export async function rejectRequisition(input: {
  requisitionId: string;
  reason: string;
}) {
  const me = await getMe();
  const role = me.role as string;
  if (![...GLOBAL_ROLES, ...INVENTORY_ROLES].includes(role)) {
    throw new Error("Sin permisos para rechazar.");
  }
  if (!input.reason?.trim()) throw new Error("Indica el motivo del rechazo.");

  const req = await prisma.requisition.findUnique({
    where: { id: input.requisitionId },
    select: { status: true, createdById: true, title: true },
  });
  if (!req) throw new Error("Requisición no encontrada.");

  await prisma.requisition.update({
    where: { id: input.requisitionId },
    data: {
      status: "REJECTED",
      note: `Rechazada: ${input.reason.trim()}`,
    },
  });

  await notifyUser({
    userId: req.createdById,
    type: "REQUISITION_REJECTED",
    title: "Tu requisición fue rechazada",
    message: `${req.title} — Motivo: ${input.reason.trim()}`,
    linkUrl: `/app/inventory/requisitions/${input.requisitionId}`,
    relatedEntityId: input.requisitionId,
    relatedEntityType: "Requisition",
  });

  revalidatePath("/app/inventory/requisitions");
  return { ok: true };
}

/* ═══════════════════════════ Marcar entrega (parcial o total) ═══════════════════════════ */

export type DeliveryLineInput = {
  requisitionItemId: string;
  qtyDelivered: number;
  notDeliveredReason?: string; // requerido si qtyDelivered < qtyRequested
};

export async function markRequisitionDelivered(input: {
  requisitionId: string;
  lines: DeliveryLineInput[];
  deliveryNote?: string;
}) {
  const me = await getMe();
  const role = me.role as string;
  if (![...GLOBAL_ROLES, ...INVENTORY_ROLES].includes(role)) {
    throw new Error("Solo el almacén puede marcar entregas.");
  }

  const req = await prisma.requisition.findUnique({
    where: { id: input.requisitionId },
    include: { items: true, createdBy: { select: { id: true } } },
  });
  if (!req) throw new Error("Requisición no encontrada.");
  if (!["APPROVED", "ORDERED"].includes(req.status)) {
    throw new Error("Solo se pueden entregar requisiciones aprobadas/en compra.");
  }

  // Validar que cada línea exista y que si es parcial tenga razón
  const itemMap = new Map(req.items.map((it) => [it.id, it]));
  let totalRequested = 0;
  let totalDelivered = 0;

  for (const line of input.lines) {
    const existing = itemMap.get(line.requisitionItemId);
    if (!existing) throw new Error(`Línea ${line.requisitionItemId} no pertenece a esta requisición.`);
    if (line.qtyDelivered < 0) throw new Error("Cantidad entregada no puede ser negativa.");
    if (line.qtyDelivered > existing.qtyRequested) {
      throw new Error("Cantidad entregada no puede ser mayor a la solicitada.");
    }
    // Si es parcial (incluye 0), requiere razón
    if (line.qtyDelivered < existing.qtyRequested && !line.notDeliveredReason?.trim()) {
      throw new Error(`Indica la razón por la que no se entregó completo: ${existing.freeTextName ?? existing.itemId}`);
    }
    totalRequested += existing.qtyRequested;
    totalDelivered += line.qtyDelivered;
  }

  // Actualizar items en transacción
  await prisma.$transaction(
    input.lines.map((line) =>
      prisma.requisitionItem.update({
        where: { id: line.requisitionItemId },
        data: {
          qtyDelivered: line.qtyDelivered,
          notDeliveredReason: line.notDeliveredReason?.trim() || null,
          deliveredAt: new Date(),
        },
      })
    )
  );

  // Determinar status final
  const isPartial = totalDelivered < totalRequested;
  const newStatus = isPartial ? "RECEIVED_PARTIAL" : "RECEIVED";

  await prisma.requisition.update({
    where: { id: input.requisitionId },
    data: {
      status: newStatus,
      deliveredAt: new Date(),
      deliveredById: (me as any).id,
      deliveryNote: input.deliveryNote?.trim() || null,
    },
  });

  // Notificar al gerente
  await notifyUser({
    userId: req.createdBy.id,
    type: isPartial ? "REQUISITION_PARTIAL" : "REQUISITION_DELIVERED",
    title: isPartial ? "Recibiste entrega parcial" : "Recibiste tu requisición completa",
    message: req.title,
    linkUrl: `/app/inventory/requisitions/${input.requisitionId}`,
    relatedEntityId: input.requisitionId,
    relatedEntityType: "Requisition",
  });

  revalidatePath("/app/inventory/requisitions");
  return { ok: true, status: newStatus };
}

/* ═══════════════════════════ Confirmar recepción (gerente firma) ═══════════════════════════ */

export async function confirmRequisitionReceipt(input: {
  requisitionId: string;
  signature: string; // nombre escrito por el gerente como firma
}) {
  const me = await getMe();

  const req = await prisma.requisition.findUnique({
    where: { id: input.requisitionId },
    select: { id: true, createdById: true, status: true },
  });
  if (!req) throw new Error("Requisición no encontrada.");

  // Solo el gerente que la pidió puede confirmar (o admin)
  const role = me.role as string;
  const isAdmin = GLOBAL_ROLES.includes(role);
  if (!isAdmin && req.createdById !== (me as any).id) {
    throw new Error("Solo quien pidió la requisición puede confirmar.");
  }

  if (!["RECEIVED", "RECEIVED_PARTIAL"].includes(req.status)) {
    throw new Error("La requisición aún no se ha entregado.");
  }

  if (!input.signature?.trim()) throw new Error("Firma requerida.");

  await prisma.requisition.update({
    where: { id: input.requisitionId },
    data: {
      status: "CLOSED",
      receivedAt: new Date(),
      receivedById: (me as any).id,
      receivedSignature: input.signature.trim(),
    },
  });

  revalidatePath("/app/inventory/requisitions");
  return { ok: true };
}

/* ═══════════════════════════ Listar items para formulario ═══════════════════════════ */

export async function getInventoryItemsForBusiness(businessId: string) {
  return prisma.inventoryItem.findMany({
    where: { businessId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      unit: true,
      onHandQty: true,
      minQty: true,
      lastPriceCents: true,
      supplierName: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { notifyUser, notifyRole } from "@/lib/notifications.actions";

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const INVENTORY_ROLES = ["INVENTORY"];

/**
 * Cancela (borrado lógico) una requisición.
 *
 * Reglas:
 * - El CREADOR puede cancelar mientras esté en DRAFT o SUBMITTED
 * - Goyo (INVENTORY) y admins (MASTER_ADMIN/OWNER/SUPERIOR) pueden cancelar
 *   en cualquier estado EXCEPTO RECEIVED, RECEIVED_PARTIAL, CLOSED
 * - Si tiene AccountsPayable PENDING, también se cancela
 * - Notifica a Goyo si lo hizo el creador
 * - Notifica al creador si lo hizo Goyo/admin
 */
export async function cancelRequisition(input: {
  requisitionId: string;
  reason: string;
}) {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = me.role as string;

  if (!input.reason?.trim()) {
    throw new Error("Indica la razón de la cancelación.");
  }

  const req = await prisma.requisition.findUnique({
    where: { id: input.requisitionId },
    select: {
      id: true,
      title: true,
      status: true,
      createdById: true,
      isPrivate: true,
      accountsPayable: { select: { id: true, status: true } },
    },
  });

  if (!req) throw new Error("Requisición no encontrada.");

  const isAdmin = GLOBAL_ROLES.includes(role);
  const isInventory = INVENTORY_ROLES.includes(role);
  const isOwner = req.createdById === userId;

  // Validar permisos según estado
  const finalStates = ["RECEIVED", "RECEIVED_PARTIAL", "CLOSED", "CANCELED"];
  if (finalStates.includes(req.status)) {
    throw new Error(
      `No se puede cancelar una requisición en estado ${req.status}.`
    );
  }

  if (isOwner) {
    // El creador solo puede cancelar en DRAFT o SUBMITTED
    if (!["DRAFT", "SUBMITTED"].includes(req.status)) {
      if (!isAdmin && !isInventory) {
        throw new Error(
          "Solo puedes cancelar tus requisiciones mientras estén en estado pendiente. Pídeselo a almacén o un administrador."
        );
      }
    }
  } else if (!isAdmin && !isInventory) {
    // No es creador ni admin/inventory: no puede
    throw new Error("Sin permisos para cancelar esta requisición.");
  }

  // OWNER_HOUSE privadas: solo Goyo o admin
  if (req.isPrivate && !isAdmin && !isInventory) {
    throw new Error("Sin permisos para cancelar esta requisición privada.");
  }

  // ─── Hacer la cancelación en transacción ──────────────────
  const ops: any[] = [
    prisma.requisition.update({
      where: { id: req.id },
      data: {
        status: "CANCELED",
        note: `[Cancelado] ${input.reason.trim()}`,
      },
    }),
  ];

  // Si tiene AccountsPayable que no esté pagada, cancelarla
  if (req.accountsPayable && req.accountsPayable.status !== "PAID") {
    ops.push(
      prisma.accountsPayable.update({
        where: { id: req.accountsPayable.id },
        data: {
          status: "CANCELED",
          note: `Cancelado porque la requisición fue cancelada: ${input.reason.trim()}`,
        },
      })
    );
  }

  await prisma.$transaction(ops);

  // ─── Notificaciones ────────────────────────────────────────
  if (isOwner) {
    // El creador la canceló: avisar a Goyo si ya estaba enviada
    if (["SUBMITTED", "APPROVED", "ORDERED"].includes(req.status)) {
      try {
        await notifyRole({
          role: "INVENTORY",
          type: "GENERAL",
          title: "Requisición cancelada por el solicitante",
          message: `"${req.title}" fue cancelada. Razón: ${input.reason.trim()}`,
          linkUrl: `/app/inventory/requisitions/${req.id}`,
          relatedEntityId: req.id,
          relatedEntityType: "Requisition",
        });
      } catch {}
    }
  } else {
    // Admin o Goyo la canceló: avisar al creador
    try {
      await notifyUser({
        userId: req.createdById,
        type: "REQUISITION_REJECTED",
        title: "Tu requisición fue cancelada",
        message: `"${req.title}" — Razón: ${input.reason.trim()}`,
        linkUrl: `/app/inventory/requisitions/${req.id}`,
        relatedEntityId: req.id,
        relatedEntityType: "Requisition",
      });
    } catch {}
  }

  revalidatePath("/app/inventory");
  revalidatePath("/app/inventory/requisitions");
  revalidatePath(`/app/inventory/requisitions/${req.id}`);
  revalidatePath("/app/manager/ops/requisitions");
  revalidatePath("/app/manager/restaurant/requisitions");
  revalidatePath("/app/manager/ranch/requisitions");

  return { ok: true };
}

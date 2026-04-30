"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";

export type NotificationKind =
  | "PAYMENT_DUE"
  | "REQUISITION_NEW"
  | "REQUISITION_APPROVED"
  | "REQUISITION_REJECTED"
  | "REQUISITION_DELIVERED"
  | "REQUISITION_PARTIAL"
  | "PAYMENT_OVERDUE"
  | "STOCK_LOW"
  | "GENERAL";

/**
 * Crea una notificación dirigida a un usuario específico.
 */
export async function notifyUser(input: {
  userId: string;
  type: NotificationKind;
  title: string;
  message?: string;
  linkUrl?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      linkUrl: input.linkUrl ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
    },
  });
}

/**
 * Crea una notificación dirigida a TODOS los usuarios de un rol.
 * Útil para "todos los de ACCOUNTING reciben este aviso".
 */
export async function notifyRole(input: {
  role: string;
  type: NotificationKind;
  title: string;
  message?: string;
  linkUrl?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}) {
  // Crear UNA notificación con targetRole — la página de notif filtrará por rol
  await prisma.notification.create({
    data: {
      targetRole: input.role,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      linkUrl: input.linkUrl ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
    },
  });
}

/**
 * Lista las notificaciones del usuario actual (suyas + las de su rol).
 */
export async function getMyNotifications(opts?: { limit?: number; onlyUnread?: boolean }) {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = me.role as string;

  return prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        { targetRole: role },
      ],
      ...(opts?.onlyUnread && { isRead: false }),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });
}

/**
 * Cuenta notificaciones no leídas (para badge en sidebar).
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = me.role as string;

  return prisma.notification.count({
    where: {
      isRead: false,
      OR: [
        { userId },
        { targetRole: role },
      ],
    },
  });
}

/**
 * Marca una notificación como leída.
 */
export async function markNotificationRead(notificationId: string) {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = me.role as string;

  // Verificar que es del usuario o de su rol antes de marcar
  const notif = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      OR: [{ userId }, { targetRole: role }],
    },
  });
  if (!notif) throw new Error("Notificación no encontrada.");

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/app/notifications");
}

/**
 * Marca todas las notificaciones del usuario como leídas.
 */
export async function markAllNotificationsRead() {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = me.role as string;

  await prisma.notification.updateMany({
    where: {
      isRead: false,
      OR: [{ userId }, { targetRole: role }],
    },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath("/app/notifications");
  return { ok: true };
}

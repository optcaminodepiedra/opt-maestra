"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";

const APPROVERS = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING",
                   "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER"];

function daysBetweenInclusive(start: Date, end: Date): number {
  const a = new Date(start);
  const b = new Date(end);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

/* ═══════════════════════════ Solicitar vacaciones ═══════════════════════════ */

export async function requestVacation(input: {
  startDateIso: string;
  endDateIso: string;
  type?: "VACATION" | "UNPAID_LEAVE" | "SICK_LEAVE" | "PERSONAL";
  note?: string;
}) {
  const me = await getMe();
  const userId = (me as any).id as string;
  const businessId = (me as any).primaryBusinessId as string | null;

  const start = new Date(input.startDateIso + "T00:00:00.000Z");
  const end = new Date(input.endDateIso + "T00:00:00.000Z");

  if (start > end) throw new Error("La fecha de fin debe ser posterior al inicio.");

  const totalDays = daysBetweenInclusive(start, end);
  if (totalDays > 60) throw new Error("La solicitud no puede exceder 60 días.");

  // Verificar si hay solicitudes traslapadas activas
  const overlap = await prisma.vacationRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) throw new Error("Tienes una solicitud activa que se traslapa con esas fechas.");

  const vr = await prisma.vacationRequest.create({
    data: {
      userId,
      businessId,
      startDate: start,
      endDate: end,
      totalDays,
      type: input.type ?? "VACATION",
      note: input.note?.trim() || null,
    },
  });

  // Actualizar balance: sumar a pendingDays (solo si es VACATION)
  if (input.type === "VACATION" || !input.type) {
    const year = start.getUTCFullYear();
    await prisma.vacationBalance.upsert({
      where: { userId_year: { userId, year } },
      update: { pendingDays: { increment: totalDays } },
      create: { userId, year, earnedDays: 12, pendingDays: totalDays },
    });
  }

  revalidatePath("/app/vacations");
  return { ok: true, id: vr.id };
}

/* ═══════════════════════════ Decidir (aprobar/rechazar) ═══════════════════════════ */

export async function decideVacation(input: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  decisionNote?: string;
}) {
  const me = await getMe();
  if (!APPROVERS.includes(me.role as string)) {
    throw new Error("Sin permisos para aprobar vacaciones.");
  }

  const vr = await prisma.vacationRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, status: true, userId: true, totalDays: true, type: true, startDate: true },
  });
  if (!vr) throw new Error("Solicitud no encontrada.");
  if (vr.status !== "PENDING") throw new Error(`Ya fue ${vr.status.toLowerCase()}.`);

  await prisma.vacationRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.decision,
      decidedById: (me as any).id,
      decidedAt: new Date(),
      decisionNote: input.decisionNote?.trim() || null,
    },
  });

  // Actualizar balance si es VACATION
  if (vr.type === "VACATION") {
    const year = vr.startDate.getUTCFullYear();
    if (input.decision === "APPROVED") {
      await prisma.vacationBalance.upsert({
        where: { userId_year: { userId: vr.userId, year } },
        update: {
          pendingDays: { decrement: vr.totalDays },
          usedDays: { increment: vr.totalDays },
        },
        create: { userId: vr.userId, year, earnedDays: 12, usedDays: vr.totalDays },
      });
    } else {
      // REJECTED: solo remover de pending
      await prisma.vacationBalance.updateMany({
        where: { userId: vr.userId, year },
        data: { pendingDays: { decrement: vr.totalDays } },
      });
    }
  }

  revalidatePath("/app/vacations");
  return { ok: true };
}

/* ═══════════════════════════ Cancelar (el solicitante) ═══════════════════════════ */

export async function cancelVacation(requestId: string) {
  const me = await getMe();
  const vr = await prisma.vacationRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true, totalDays: true, type: true, startDate: true },
  });
  if (!vr) throw new Error("Solicitud no encontrada.");
  if (vr.userId !== (me as any).id && !APPROVERS.includes(me.role as string)) {
    throw new Error("Sin permisos.");
  }
  if (vr.status === "CANCELED") throw new Error("Ya está cancelada.");

  await prisma.vacationRequest.update({
    where: { id: requestId },
    data: { status: "CANCELED" },
  });

  // Revertir balance
  if (vr.type === "VACATION") {
    const year = vr.startDate.getUTCFullYear();
    if (vr.status === "PENDING") {
      await prisma.vacationBalance.updateMany({
        where: { userId: vr.userId, year },
        data: { pendingDays: { decrement: vr.totalDays } },
      });
    } else if (vr.status === "APPROVED") {
      await prisma.vacationBalance.updateMany({
        where: { userId: vr.userId, year },
        data: { usedDays: { decrement: vr.totalDays } },
      });
    }
  }

  revalidatePath("/app/vacations");
  return { ok: true };
}

/* ═══════════════════════════ Obtener/crear balance del año ═══════════════════════════ */

export async function getOrCreateBalance(userId: string, year?: number) {
  const y = year ?? new Date().getFullYear();
  const existing = await prisma.vacationBalance.findUnique({
    where: { userId_year: { userId, year: y } },
  });
  if (existing) return existing;
  return prisma.vacationBalance.create({
    data: { userId, year: y, earnedDays: 12 },
  });
}

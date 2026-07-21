"use server";

import {
  EventPaymentStatus,
  EventPaymentTiming,
  EventStatus,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { EVENT_CREATE_ROLES } from "@/lib/events.queries";
import type { CreateEventInput } from "@/lib/events.types";
import { notifyUser } from "@/lib/notifications.actions";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";

const GLOBAL_BUSINESS_ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "ACCOUNTING",
  "INVENTORY",
];

function cleanText(value: string | undefined, maxLength: number): string | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function parseMexicoLocalDateTime(value: string, label: string): Date {
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
    ? `${raw}:00`
    : raw;
  const date = new Date(`${normalized}-06:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} no tiene una fecha u hora válida.`);
  }
  return date;
}

function parseMexicoDueDate(value?: string): Date | null {
  const raw = value?.trim();
  if (!raw) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T23:59:59`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
      ? `${raw}:00`
      : raw;

  const date = new Date(`${normalized}-06:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha límite de pago no es válida.");
  }
  return date;
}

function toWholeNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100_000) {
    throw new Error(`${label} debe ser un número entre 0 y 100,000.`);
  }
  return Math.round(value);
}

function toMoneyCents(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
    throw new Error(`${label} no es válido.`);
  }
  return Math.round(value * 100);
}

async function getCreateScope() {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = (me as any).role as string;

  if (!EVENT_CREATE_ROLES.includes(role)) {
    throw new Error("No tienes permisos para crear eventos.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      businessId: true,
      primaryBusinessId: true,
      businessAccess: { select: { businessId: true } },
    },
  });

  if (!user || !user.id) throw new Error("No se encontró el usuario activo.");

  const isGlobal = GLOBAL_BUSINESS_ROLES.includes(role);
  let businessIds: string[];

  if (isGlobal) {
    businessIds = (
      await prisma.business.findMany({ select: { id: true }, orderBy: { name: "asc" } })
    ).map((business) => business.id);
  } else {
    const ids = new Set<string>();
    if (user.businessId) ids.add(user.businessId);
    if (user.primaryBusinessId) ids.add(user.primaryBusinessId);
    for (const access of user.businessAccess) ids.add(access.businessId);
    businessIds = Array.from(ids);
  }

  return { user, role, isGlobal, businessIds };
}

function resolvePayment(input: CreateEventInput) {
  let paymentTiming = input.paymentTiming as EventPaymentTiming;
  let paymentStatus = input.paymentStatus as EventPaymentStatus;
  let quotedAmountCents = toMoneyCents(input.quotedAmount, "El importe cotizado");
  let paidAmountCents = toMoneyCents(input.paidAmount, "El importe pagado");
  let paymentDueAt = parseMexicoDueDate(input.paymentDueLocal);

  if (paymentTiming === EventPaymentTiming.NO_CHARGE) {
    paymentStatus = EventPaymentStatus.NOT_REQUIRED;
    quotedAmountCents = 0;
    paidAmountCents = 0;
    paymentDueAt = null;
  } else {
    if (paymentStatus === EventPaymentStatus.NOT_REQUIRED) {
      paymentStatus = EventPaymentStatus.PENDING;
    }

    if (quotedAmountCents > 0 && paidAmountCents > quotedAmountCents) {
      throw new Error("El importe pagado no puede ser mayor al cotizado.");
    }

    if (paidAmountCents > 0 && quotedAmountCents > 0 && paidAmountCents >= quotedAmountCents) {
      paymentStatus = EventPaymentStatus.PAID;
    } else if (paidAmountCents > 0) {
      paymentStatus = EventPaymentStatus.PARTIAL;
    } else if (paymentStatus === EventPaymentStatus.PAID || paymentStatus === EventPaymentStatus.PARTIAL) {
      paymentStatus = EventPaymentStatus.PENDING;
    }
  }

  return {
    paymentTiming,
    paymentStatus,
    quotedAmountCents,
    paidAmountCents,
    paymentDueAt,
  };
}

export async function createEvent(input: CreateEventInput) {
  const scope = await getCreateScope();

  const title = cleanText(input.title, 160);
  if (!title || title.length < 3) {
    throw new Error("Escribe un nombre para el evento de al menos 3 caracteres.");
  }

  if (!scope.businessIds.includes(input.businessId)) {
    throw new Error("No tienes acceso al negocio organizador seleccionado.");
  }

  const locationBusinessId = input.locationBusinessId?.trim() || null;
  if (locationBusinessId && !scope.businessIds.includes(locationBusinessId)) {
    throw new Error("No tienes acceso al lugar seleccionado.");
  }

  const locationName = cleanText(input.locationName, 180);
  if (!locationBusinessId && !locationName) {
    throw new Error("Selecciona un negocio como sede o escribe el nombre del lugar.");
  }

  const startsAt = parseMexicoLocalDateTime(input.startsAtLocal, "La fecha de inicio");
  const endsAt = input.endsAtLocal?.trim()
    ? parseMexicoLocalDateTime(input.endsAtLocal, "La fecha de término")
    : null;

  if (endsAt && endsAt < startsAt) {
    throw new Error("La fecha de término no puede ser anterior al inicio.");
  }

  const estimatedGuests = toWholeNumber(input.estimatedGuests, "Las personas estimadas");
  const confirmedGuests = toWholeNumber(input.confirmedGuests, "Las personas confirmadas");

  const status = input.status as EventStatus;
  if (![EventStatus.DRAFT, EventStatus.TENTATIVE, EventStatus.CONFIRMED].includes(status)) {
    throw new Error("El estado inicial del evento no es válido.");
  }

  const responsibleUserId = input.responsibleUserId?.trim() || null;
  if (responsibleUserId) {
    const responsibleWhere: Prisma.UserWhereInput = {
      id: responsibleUserId,
      isActive: true,
      ...(scope.isGlobal
        ? {}
        : {
            OR: [
              { id: scope.user.id },
              { businessId: { in: scope.businessIds } },
              { primaryBusinessId: { in: scope.businessIds } },
              { businessAccess: { some: { businessId: { in: scope.businessIds } } } },
            ],
          }),
    };

    const responsible = await prisma.user.findFirst({
      where: responsibleWhere,
      select: { id: true },
    });
    if (!responsible) throw new Error("El responsable seleccionado no es válido.");
  }

  const requisitionIds = Array.from(
    new Set((input.requisitionIds ?? []).filter(Boolean))
  ).slice(0, 200);

  if (requisitionIds.length > 0) {
    const requisitionCount = await prisma.requisition.count({
      where: {
        id: { in: requisitionIds },
        eventId: null,
        ...(scope.isGlobal ? {} : { businessId: { in: scope.businessIds } }),
      },
    });
    if (requisitionCount !== requisitionIds.length) {
      throw new Error(
        "Una o más requisiciones ya fueron asociadas a otro evento o no están disponibles. Actualiza la página e inténtalo nuevamente."
      );
    }
  }

  const requirements = (input.requirements ?? [])
    .filter((requirement) => requirement.description?.trim())
    .slice(0, 50)
    .map((requirement, index) => {
      const quantity =
        requirement.quantity === null || requirement.quantity === undefined
          ? null
          : Number(requirement.quantity);

      if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000)) {
        throw new Error(`La cantidad del requerimiento ${index + 1} no es válida.`);
      }

      return {
        category: cleanText(requirement.category, 80),
        description: requirement.description.trim().slice(0, 300),
        quantity,
        unit: cleanText(requirement.unit, 40),
        responsibleUserId: requirement.responsibleUserId?.trim() || null,
        neededBy: requirement.neededByLocal?.trim()
          ? parseMexicoLocalDateTime(
              requirement.neededByLocal,
              `La fecha del requerimiento ${index + 1}`
            )
          : null,
        notes: cleanText(requirement.notes, 500),
        sortOrder: index,
      };
    });

  const requirementResponsibleIds = Array.from(
    new Set(requirements.map((item) => item.responsibleUserId).filter(Boolean) as string[])
  );

  if (requirementResponsibleIds.length > 0) {
    const count = await prisma.user.count({
      where: {
        id: { in: requirementResponsibleIds },
        isActive: true,
        ...(scope.isGlobal
          ? {}
          : {
              OR: [
                { id: scope.user.id },
                { businessId: { in: scope.businessIds } },
                { primaryBusinessId: { in: scope.businessIds } },
                { businessAccess: { some: { businessId: { in: scope.businessIds } } } },
              ],
            }),
      },
    });
    if (count !== requirementResponsibleIds.length) {
      throw new Error("Uno de los responsables de requerimientos no es válido.");
    }
  }

  const payment = resolvePayment(input);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        businessId: input.businessId,
        locationBusinessId,
        title,
        eventType: cleanText(input.eventType, 100),
        status,
        startsAt,
        endsAt,
        estimatedGuests,
        confirmedGuests,
        locationName,
        locationAddress: cleanText(input.locationAddress, 300),
        contactName: cleanText(input.contactName, 160),
        contactPhone: cleanText(input.contactPhone, 50),
        contactEmail: cleanText(input.contactEmail, 160)?.toLowerCase() ?? null,
        description: cleanText(input.description, 4_000),
        internalNotes: cleanText(input.internalNotes, 4_000),
        isPrivate: Boolean(input.isPrivate),
        ...payment,
        paymentNotes: cleanText(input.paymentNotes, 2_000),
        createdById: scope.user.id,
        responsibleUserId,
        requirements: requirements.length
          ? {
              create: requirements,
            }
          : undefined,
      },
      select: {
        id: true,
        title: true,
        businessId: true,
        startsAt: true,
        responsibleUserId: true,
      },
    });

    if (requisitionIds.length > 0) {
      const linked = await tx.requisition.updateMany({
        where: {
          id: { in: requisitionIds },
          eventId: null,
          ...(scope.isGlobal ? {} : { businessId: { in: scope.businessIds } }),
        },
        data: {
          eventId: created.id,
          eventName: created.title,
        },
      });

      if (linked.count !== requisitionIds.length) {
        throw new Error("No fue posible asociar todas las requisiciones seleccionadas.");
      }
    }

    return created;
  });

  await logAudit({
    user: {
      id: scope.user.id,
      name: scope.user.username || scope.user.fullName,
      role: scope.role,
    },
    businessId: event.businessId,
    action: AUDIT_ACTIONS.EVENT_CREATED,
    entity: "Event",
    entityId: event.id,
    severity: "LOW",
    summary: `Creó el evento ${event.title}`,
    metadata: {
      startsAt: event.startsAt.toISOString(),
      estimatedGuests,
      confirmedGuests,
      requisitionsLinked: requisitionIds.length,
      requirementsCreated: requirements.length,
      paymentTiming: payment.paymentTiming,
      paymentStatus: payment.paymentStatus,
    },
  });

  if (event.responsibleUserId && event.responsibleUserId !== scope.user.id) {
    await notifyUser({
      userId: event.responsibleUserId,
      type: "GENERAL",
      title: "Nuevo evento asignado",
      message: `${event.title} · ${new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(event.startsAt)}`,
      linkUrl: "/app/events",
      relatedEntityId: event.id,
      relatedEntityType: "Event",
    });
  }

  revalidatePath("/app/events");
  revalidatePath("/app/notifications");

  return { ok: true, eventId: event.id };
}

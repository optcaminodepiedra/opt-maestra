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
import type {
  CreateEventInput,
  EventActionResult,
  EventRequirementInput,
  UpdateEventInput,
} from "@/lib/events.types";
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

const EVENT_DELETE_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

class EventActionError extends Error {}

function actionFailure(error: unknown, fallback: string): EventActionResult {
  if (error instanceof EventActionError) {
    return { ok: false, error: error.message };
  }

  console.error(fallback, error);
  return {
    ok: false,
    error: "No fue posible completar la operación. Actualiza la página e inténtalo nuevamente.",
  };
}

function cleanText(value: string | undefined, maxLength: number): string | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function parseMexicoLocalDateTime(value: string, label: string): Date {
  const raw = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);

  if (!match) {
    throw new EventActionError(`${label} no tiene una fecha u hora válida.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const localCheck = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const isValid =
    localCheck.getUTCFullYear() === year &&
    localCheck.getUTCMonth() === month - 1 &&
    localCheck.getUTCDate() === day &&
    localCheck.getUTCHours() === hour &&
    localCheck.getUTCMinutes() === minute;

  if (!isValid) {
    throw new EventActionError(`${label} no tiene una fecha u hora válida.`);
  }

  // Guanajuato usa UTC-6. Convertimos la hora escrita por el usuario a UTC.
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, 0, 0));
}

function parseMexicoDueDate(value?: string): Date | null {
  const raw = value?.trim();
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    throw new EventActionError("La fecha límite de pago no es válida.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    localCheck.getUTCFullYear() !== year ||
    localCheck.getUTCMonth() !== month - 1 ||
    localCheck.getUTCDate() !== day
  ) {
    throw new EventActionError("La fecha límite de pago no es válida.");
  }

  // 23:59 de Guanajuato expresado en UTC.
  return new Date(Date.UTC(year, month - 1, day, 29, 59, 0, 0));
}

function toWholeNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100_000) {
    throw new EventActionError(`${label} debe ser un número entre 0 y 100,000.`);
  }
  return Math.round(value);
}

function toMoneyCents(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000) {
    throw new EventActionError(`${label} no es válido.`);
  }
  return Math.round(value * 100);
}

async function getActionScope() {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = (me as any).role as string;

  if (!EVENT_CREATE_ROLES.includes(role)) {
    throw new EventActionError("No tienes permisos para administrar eventos.");
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

  if (!user?.id) throw new EventActionError("No se encontró el usuario activo.");

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

type ActionScope = Awaited<ReturnType<typeof getActionScope>>;

function resolvePayment(input: CreateEventInput) {
  if (!Object.values(EventPaymentTiming).includes(input.paymentTiming as EventPaymentTiming)) {
    throw new EventActionError("La condición de pago seleccionada no es válida.");
  }
  if (!Object.values(EventPaymentStatus).includes(input.paymentStatus as EventPaymentStatus)) {
    throw new EventActionError("El estado de pago seleccionado no es válido.");
  }

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
      throw new EventActionError("El importe pagado no puede ser mayor al cotizado.");
    }

    if (paidAmountCents > 0 && quotedAmountCents > 0 && paidAmountCents >= quotedAmountCents) {
      paymentStatus = EventPaymentStatus.PAID;
    } else if (paidAmountCents > 0) {
      paymentStatus = EventPaymentStatus.PARTIAL;
    } else if (
      paymentStatus === EventPaymentStatus.PAID ||
      paymentStatus === EventPaymentStatus.PARTIAL
    ) {
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

async function validateResponsibleUsers(
  scope: ActionScope,
  responsibleUserId: string | null,
  requirements: Array<{ responsibleUserId: string | null }>
) {
  const ids = new Set<string>();
  if (responsibleUserId) ids.add(responsibleUserId);
  for (const requirement of requirements) {
    if (requirement.responsibleUserId) ids.add(requirement.responsibleUserId);
  }

  if (ids.size === 0) return;

  const count = await prisma.user.count({
    where: {
      id: { in: Array.from(ids) },
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

  if (count !== ids.size) {
    throw new EventActionError("Uno de los responsables seleccionados no es válido.");
  }
}

async function normalizeEventInput(
  scope: ActionScope,
  input: CreateEventInput,
  currentEventId?: string
) {
  const title = cleanText(input.title, 160);
  if (!title || title.length < 3) {
    throw new EventActionError("Escribe un nombre para el evento de al menos 3 caracteres.");
  }

  if (!scope.businessIds.includes(input.businessId)) {
    throw new EventActionError("No tienes acceso al negocio organizador seleccionado.");
  }

  const locationBusinessId = input.locationBusinessId?.trim() || null;
  if (locationBusinessId && !scope.businessIds.includes(locationBusinessId)) {
    throw new EventActionError("No tienes acceso al lugar seleccionado.");
  }

  const locationName = cleanText(input.locationName, 180);
  if (!locationBusinessId && !locationName) {
    throw new EventActionError("Selecciona un negocio como sede o escribe el nombre del lugar.");
  }

  const startsAt = parseMexicoLocalDateTime(input.startsAtLocal, "La fecha de inicio");
  const endsAt = input.endsAtLocal?.trim()
    ? parseMexicoLocalDateTime(input.endsAtLocal, "La fecha de término")
    : null;

  if (endsAt && endsAt.getTime() < startsAt.getTime()) {
    throw new EventActionError(
      "La fecha y hora de término deben ser posteriores a la fecha y hora de inicio."
    );
  }

  const estimatedGuests = toWholeNumber(input.estimatedGuests, "Las personas estimadas");
  const confirmedGuests = toWholeNumber(input.confirmedGuests, "Las personas confirmadas");

  const status = input.status as EventStatus;
  const allowedStatuses = currentEventId
    ? Object.values(EventStatus)
    : [EventStatus.DRAFT, EventStatus.TENTATIVE, EventStatus.CONFIRMED];

  if (!allowedStatuses.includes(status)) {
    throw new EventActionError("El estado seleccionado no es válido.");
  }

  const responsibleUserId = input.responsibleUserId?.trim() || null;

  const requisitionIds = Array.from(new Set((input.requisitionIds ?? []).filter(Boolean))).slice(
    0,
    200
  );

  if (requisitionIds.length > 0) {
    const requisitionCount = await prisma.requisition.count({
      where: {
        id: { in: requisitionIds },
        OR: currentEventId ? [{ eventId: null }, { eventId: currentEventId }] : [{ eventId: null }],
        ...(scope.isGlobal ? {} : { businessId: { in: scope.businessIds } }),
      },
    });

    if (requisitionCount !== requisitionIds.length) {
      throw new EventActionError(
        "Una o más requisiciones ya pertenecen a otro evento o ya no están disponibles. Actualiza la página."
      );
    }
  }

  const requirements = (input.requirements ?? [])
    .filter((requirement) => requirement.description?.trim())
    .slice(0, 50)
    .map((requirement: EventRequirementInput, index) => {
      const quantity =
        requirement.quantity === null || requirement.quantity === undefined
          ? null
          : Number(requirement.quantity);

      if (
        quantity !== null &&
        (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000)
      ) {
        throw new EventActionError(`La cantidad del requerimiento ${index + 1} no es válida.`);
      }

      return {
        id: requirement.id?.trim() || null,
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

  if (currentEventId) {
    const requirementIds = requirements
      .map((requirement) => requirement.id)
      .filter(Boolean) as string[];

    if (requirementIds.length > 0) {
      const count = await prisma.eventRequirement.count({
        where: { eventId: currentEventId, id: { in: requirementIds } },
      });
      if (count !== requirementIds.length) {
        throw new EventActionError("Uno de los requerimientos ya no pertenece a este evento.");
      }
    }
  }

  await validateResponsibleUsers(scope, responsibleUserId, requirements);

  return {
    title,
    eventType: cleanText(input.eventType, 100),
    status,
    businessId: input.businessId,
    locationBusinessId,
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
    ...resolvePayment(input),
    paymentNotes: cleanText(input.paymentNotes, 2_000),
    responsibleUserId,
    requisitionIds,
    requirements,
  };
}

function canManageExistingEvent(
  scope: ActionScope,
  event: { businessId: string; locationBusinessId: string | null; createdById: string; responsibleUserId: string | null }
): boolean {
  if (scope.isGlobal) return true;
  if (event.createdById === scope.user.id || event.responsibleUserId === scope.user.id) return true;
  return (
    scope.businessIds.includes(event.businessId) ||
    Boolean(event.locationBusinessId && scope.businessIds.includes(event.locationBusinessId))
  );
}

export async function createEvent(input: CreateEventInput): Promise<EventActionResult> {
  try {
    const scope = await getActionScope();
    const normalized = await normalizeEventInput(scope, input);

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          businessId: normalized.businessId,
          locationBusinessId: normalized.locationBusinessId,
          title: normalized.title,
          eventType: normalized.eventType,
          status: normalized.status,
          startsAt: normalized.startsAt,
          endsAt: normalized.endsAt,
          estimatedGuests: normalized.estimatedGuests,
          confirmedGuests: normalized.confirmedGuests,
          locationName: normalized.locationName,
          locationAddress: normalized.locationAddress,
          contactName: normalized.contactName,
          contactPhone: normalized.contactPhone,
          contactEmail: normalized.contactEmail,
          description: normalized.description,
          internalNotes: normalized.internalNotes,
          isPrivate: normalized.isPrivate,
          paymentTiming: normalized.paymentTiming,
          paymentStatus: normalized.paymentStatus,
          quotedAmountCents: normalized.quotedAmountCents,
          paidAmountCents: normalized.paidAmountCents,
          paymentDueAt: normalized.paymentDueAt,
          paymentNotes: normalized.paymentNotes,
          createdById: scope.user.id,
          responsibleUserId: normalized.responsibleUserId,
          requirements: normalized.requirements.length
            ? {
                create: normalized.requirements.map(({ id: _id, ...requirement }) => requirement),
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

      if (normalized.requisitionIds.length > 0) {
        const linked = await tx.requisition.updateMany({
          where: {
            id: { in: normalized.requisitionIds },
            eventId: null,
            ...(scope.isGlobal ? {} : { businessId: { in: scope.businessIds } }),
          },
          data: { eventId: created.id, eventName: created.title },
        });

        if (linked.count !== normalized.requisitionIds.length) {
          throw new EventActionError("No fue posible asociar todas las requisiciones seleccionadas.");
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
        estimatedGuests: normalized.estimatedGuests,
        confirmedGuests: normalized.confirmedGuests,
        requisitionsLinked: normalized.requisitionIds.length,
        requirementsCreated: normalized.requirements.length,
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
          hour12: false,
        }).format(event.startsAt)}`,
        linkUrl: `/app/events/${event.id}`,
        relatedEntityId: event.id,
        relatedEntityType: "Event",
      });
    }

    revalidatePath("/app/events");
    revalidatePath("/app/notifications");
    return { ok: true, eventId: event.id };
  } catch (error) {
    return actionFailure(error, "Error al crear evento");
  }
}

export async function updateEvent(input: UpdateEventInput): Promise<EventActionResult> {
  try {
    const scope = await getActionScope();
    const current = await prisma.event.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        title: true,
        businessId: true,
        locationBusinessId: true,
        createdById: true,
        responsibleUserId: true,
        status: true,
      },
    });

    if (!current) throw new EventActionError("El evento ya no existe.");
    if (!canManageExistingEvent(scope, current)) {
      throw new EventActionError("No tienes permisos para editar este evento.");
    }

    const normalized = await normalizeEventInput(scope, input, current.id);

    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: current.id },
        data: {
          businessId: normalized.businessId,
          locationBusinessId: normalized.locationBusinessId,
          title: normalized.title,
          eventType: normalized.eventType,
          status: normalized.status,
          startsAt: normalized.startsAt,
          endsAt: normalized.endsAt,
          estimatedGuests: normalized.estimatedGuests,
          confirmedGuests: normalized.confirmedGuests,
          locationName: normalized.locationName,
          locationAddress: normalized.locationAddress,
          contactName: normalized.contactName,
          contactPhone: normalized.contactPhone,
          contactEmail: normalized.contactEmail,
          description: normalized.description,
          internalNotes: normalized.internalNotes,
          isPrivate: normalized.isPrivate,
          paymentTiming: normalized.paymentTiming,
          paymentStatus: normalized.paymentStatus,
          quotedAmountCents: normalized.quotedAmountCents,
          paidAmountCents: normalized.paidAmountCents,
          paymentDueAt: normalized.paymentDueAt,
          paymentNotes: normalized.paymentNotes,
          responsibleUserId: normalized.responsibleUserId,
        },
      });

      const keptRequirementIds = normalized.requirements
        .map((requirement) => requirement.id)
        .filter(Boolean) as string[];

      await tx.eventRequirement.deleteMany({
        where: {
          eventId: current.id,
          ...(keptRequirementIds.length > 0 ? { id: { notIn: keptRequirementIds } } : {}),
        },
      });

      for (const requirement of normalized.requirements) {
        const { id, ...data } = requirement;
        if (id) {
          const updated = await tx.eventRequirement.updateMany({
            where: { id, eventId: current.id },
            data,
          });
          if (updated.count !== 1) {
            throw new EventActionError("No fue posible actualizar uno de los requerimientos.");
          }
        } else {
          await tx.eventRequirement.create({
            data: { eventId: current.id, ...data },
          });
        }
      }

      await tx.requisition.updateMany({
        where: {
          eventId: current.id,
          ...(normalized.requisitionIds.length > 0
            ? { id: { notIn: normalized.requisitionIds } }
            : {}),
        },
        data: { eventId: null },
      });

      if (normalized.requisitionIds.length > 0) {
        const linked = await tx.requisition.updateMany({
          where: {
            id: { in: normalized.requisitionIds },
            OR: [{ eventId: null }, { eventId: current.id }],
            ...(scope.isGlobal ? {} : { businessId: { in: scope.businessIds } }),
          },
          data: { eventId: current.id, eventName: normalized.title },
        });

        if (linked.count !== normalized.requisitionIds.length) {
          throw new EventActionError("No fue posible actualizar las requisiciones asociadas.");
        }
      }
    });

    await logAudit({
      user: {
        id: scope.user.id,
        name: scope.user.username || scope.user.fullName,
        role: scope.role,
      },
      businessId: normalized.businessId,
      action:
        current.status !== normalized.status
          ? AUDIT_ACTIONS.EVENT_STATUS_CHANGED
          : AUDIT_ACTIONS.EVENT_EDITED,
      entity: "Event",
      entityId: current.id,
      severity: "MEDIUM",
      summary: `Editó el evento ${normalized.title}`,
      metadata: {
        previousTitle: current.title,
        previousStatus: current.status,
        status: normalized.status,
        requisitionsLinked: normalized.requisitionIds.length,
        requirements: normalized.requirements.length,
      },
    });

    if (
      normalized.responsibleUserId &&
      normalized.responsibleUserId !== current.responsibleUserId &&
      normalized.responsibleUserId !== scope.user.id
    ) {
      await notifyUser({
        userId: normalized.responsibleUserId,
        type: "GENERAL",
        title: "Evento asignado",
        message: normalized.title,
        linkUrl: `/app/events/${current.id}`,
        relatedEntityId: current.id,
        relatedEntityType: "Event",
      });
    }

    revalidatePath("/app/events");
    revalidatePath(`/app/events/${current.id}`);
    revalidatePath(`/app/events/${current.id}/edit`);
    revalidatePath("/app/notifications");
    return { ok: true, eventId: current.id };
  } catch (error) {
    return actionFailure(error, "Error al editar evento");
  }
}

export async function deleteEvent(eventId: string): Promise<EventActionResult> {
  try {
    const scope = await getActionScope();
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        status: true,
        businessId: true,
        locationBusinessId: true,
        createdById: true,
        responsibleUserId: true,
      },
    });

    if (!event) throw new EventActionError("El evento ya no existe.");
    if (!canManageExistingEvent(scope, event)) {
      throw new EventActionError("No tienes permisos para eliminar este evento.");
    }

    const isDirector = EVENT_DELETE_ROLES.includes(scope.role);
    const isCreatorOfOpenEvent =
      event.createdById === scope.user.id &&
      [EventStatus.DRAFT, EventStatus.TENTATIVE].includes(event.status);

    if (!isDirector && !isCreatorOfOpenEvent) {
      throw new EventActionError(
        "Solo dirección puede eliminar eventos confirmados o eventos creados por otra persona."
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.requisition.updateMany({
        where: { eventId: event.id },
        data: { eventId: null },
      });
      await tx.event.delete({ where: { id: event.id } });
    });

    await logAudit({
      user: {
        id: scope.user.id,
        name: scope.user.username || scope.user.fullName,
        role: scope.role,
      },
      businessId: event.businessId,
      action: AUDIT_ACTIONS.EVENT_DELETED,
      entity: "Event",
      entityId: event.id,
      severity: "HIGH",
      summary: `Eliminó el evento ${event.title}`,
      metadata: { status: event.status },
    });

    revalidatePath("/app/events");
    return { ok: true, eventId: event.id };
  } catch (error) {
    return actionFailure(error, "Error al eliminar evento");
  }
}

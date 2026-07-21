import "server-only";

import { EventRequirementStatus, EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import type { EventCreateData, EventFormInitialData } from "@/lib/events.types";

export const EVENT_STATUSES = [
  "DRAFT",
  "TENTATIVE",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
] as const;

export const EVENT_RANGES = ["upcoming", "next7", "next30", "past", "all"] as const;

export type EventStatusFilter = (typeof EVENT_STATUSES)[number] | "all";
export type EventRangeFilter = (typeof EVENT_RANGES)[number];

export type EventDashboardFilters = {
  q: string;
  businessId: string;
  status: EventStatusFilter;
  range: EventRangeFilter;
};

export type EventDashboardRow = {
  id: string;
  title: string;
  eventType: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  estimatedGuests: number;
  confirmedGuests: number;
  locationName: string | null;
  isPrivate: boolean;
  business: { id: string; name: string };
  locationBusiness: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string };
  responsibleUser: { id: string; fullName: string } | null;
  requirementsTotal: number;
  requirementsPending: number;
  requirementsReady: number;
  requisitionsCount: number;
  paymentTiming: string;
  paymentStatus: string;
  quotedAmountCents: number;
  paidAmountCents: number;
  paymentDueAt: Date | null;
};

export type EventDashboardData = {
  filters: EventDashboardFilters;
  businesses: { id: string; name: string }[];
  userScope: {
    role: string;
    canViewPrivate: boolean;
    hasBusinessScope: boolean;
    canCreateEvents: boolean;
    canViewFinancials: boolean;
  };
  stats: {
    next7: number;
    next30: number;
    guestsNext30: number;
    pendingRequirements: number;
  };
  events: EventDashboardRow[];
};

const GLOBAL_BUSINESS_ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "ACCOUNTING",
  "INVENTORY",
];

const PRIVATE_EVENT_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
export const EVENT_CREATE_ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "MANAGER",
  "MANAGER_OPS",
  "MANAGER_RESTAURANT",
  "MANAGER_HOTEL",
  "MANAGER_RANCH",
  "SALES",
  "RESERVATIONS",
  "STAFF_RECEPTION",
  "STAFF_EXPERIENCES",
];

const REQUISITION_CREATE_ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "INVENTORY",
  "MANAGER",
  "MANAGER_OPS",
  "MANAGER_RESTAURANT",
  "MANAGER_HOTEL",
  "MANAGER_RANCH",
];
export const EVENT_FINANCIAL_ROLES = [
  "MASTER_ADMIN",
  "OWNER",
  "SUPERIOR",
  "ACCOUNTING",
  "MANAGER",
  "MANAGER_OPS",
  "MANAGER_RESTAURANT",
  "MANAGER_HOTEL",
  "MANAGER_RANCH",
  "SALES",
  "RESERVATIONS",
  "STAFF_RECEPTION",
];
const ACTIVE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.TENTATIVE,
  EventStatus.CONFIRMED,
  EventStatus.IN_PROGRESS,
];
const PENDING_REQUIREMENT_STATUSES: EventRequirementStatus[] = [
  EventRequirementStatus.PENDING,
  EventRequirementStatus.IN_PROGRESS,
];

function normalizeFilters(input: Record<string, string | undefined>): EventDashboardFilters {
  const range = EVENT_RANGES.includes(input.range as EventRangeFilter)
    ? (input.range as EventRangeFilter)
    : "upcoming";

  const status = EVENT_STATUSES.includes(input.status as (typeof EVENT_STATUSES)[number])
    ? (input.status as EventStatusFilter)
    : "all";

  return {
    q: (input.q ?? "").trim().slice(0, 120),
    businessId: (input.businessId ?? "all").trim() || "all",
    status,
    range,
  };
}

function mexicoTodayStart(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  // Guanajuato / Ciudad de México usan UTC-6 sin horario de verano.
  return new Date(Date.UTC(year, month - 1, day, 6, 0, 0, 0));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function resolveEventScope() {
  const me = await getMe();
  const userId = (me as any).id as string;
  const role = (me as any).role as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      businessId: true,
      primaryBusinessId: true,
      businessAccess: { select: { businessId: true } },
    },
  });

  if (!user) throw new Error("No se encontró el usuario activo.");

  const isGlobalBusiness = GLOBAL_BUSINESS_ROLES.includes(role);
  const canViewPrivate = PRIVATE_EVENT_ROLES.includes(role);

  let businessIds: string[] = [];

  if (!isGlobalBusiness) {
    const ids = new Set<string>();
    if (user.businessId) ids.add(user.businessId);
    if (user.primaryBusinessId) ids.add(user.primaryBusinessId);
    for (const access of user.businessAccess) ids.add(access.businessId);
    businessIds = Array.from(ids);
  }

  const [businesses, viewBusinesses] = await Promise.all([
    prisma.business.findMany({
      where: isGlobalBusiness ? undefined : { id: { in: businessIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (isGlobalBusiness) businessIds = businesses.map((business) => business.id);

  // La agenda es información operativa general: todos los puestos pueden ver
  // los eventos de todos los negocios, aunque no tengan acceso administrativo
  // a la unidad que los organiza. La edición y creación continúan limitadas por
  // businessIds y por los roles definidos más abajo.
  const visibilityWhere: Prisma.EventWhereInput = {};

  const privacyWhere: Prisma.EventWhereInput = canViewPrivate
    ? {}
    : {
        OR: [
          { isPrivate: false },
          { createdById: userId },
          { responsibleUserId: userId },
        ],
      };

  return {
    userId,
    role,
    businessIds,
    businesses,
    viewBusinesses,
    canViewPrivate,
    visibilityWhere,
    privacyWhere,
  };
}

function buildRangeWhere(
  range: EventRangeFilter,
  today: Date,
  explicitStatus: EventStatusFilter
): Prisma.EventWhereInput {
  const activeStatusWhere =
    explicitStatus === "all" ? { status: { in: ACTIVE_EVENT_STATUSES } } : {};

  switch (range) {
    case "next7":
      return {
        startsAt: { gte: today, lt: addDays(today, 7) },
        ...activeStatusWhere,
      };
    case "next30":
      return {
        startsAt: { gte: today, lt: addDays(today, 30) },
        ...activeStatusWhere,
      };
    case "past":
      return { startsAt: { lt: today } };
    case "all":
      return {};
    case "upcoming":
    default:
      return {
        startsAt: { gte: today },
        ...activeStatusWhere,
      };
  }
}

export async function getEventsDashboardData(
  rawFilters: Record<string, string | undefined>
): Promise<EventDashboardData> {
  const filters = normalizeFilters(rawFilters);
  const scope = await resolveEventScope();
  const today = mexicoTodayStart();

  const selectedBusinessId = scope.viewBusinesses.some(
    (business) => business.id === filters.businessId
  )
    ? filters.businessId
    : "all";

  filters.businessId = selectedBusinessId;

  const filterWhere: Prisma.EventWhereInput = {
    AND: [
      scope.visibilityWhere,
      scope.privacyWhere,
      buildRangeWhere(filters.range, today, filters.status),
      filters.status !== "all" ? { status: filters.status as EventStatus } : {},
      selectedBusinessId !== "all"
        ? {
            OR: [
              { businessId: selectedBusinessId },
              { locationBusinessId: selectedBusinessId },
            ],
          }
        : {},
      filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { eventType: { contains: filters.q, mode: "insensitive" } },
              { locationName: { contains: filters.q, mode: "insensitive" } },
              { contactName: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const statsWhere: Prisma.EventWhereInput = {
    AND: [
      scope.visibilityWhere,
      scope.privacyWhere,
      { startsAt: { gte: today } },
      { status: { in: ACTIVE_EVENT_STATUSES } },
    ],
  };

  const [rows, statRows] = await Promise.all([
    prisma.event.findMany({
      where: filterWhere,
      orderBy: filters.range === "past" ? { startsAt: "desc" } : { startsAt: "asc" },
      take: 150,
      select: {
        id: true,
        title: true,
        eventType: true,
        status: true,
        startsAt: true,
        endsAt: true,
        estimatedGuests: true,
        confirmedGuests: true,
        locationName: true,
        isPrivate: true,
        paymentTiming: true,
        paymentStatus: true,
        quotedAmountCents: true,
        paidAmountCents: true,
        paymentDueAt: true,
        business: { select: { id: true, name: true } },
        locationBusiness: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        responsibleUser: { select: { id: true, fullName: true } },
        requirements: { select: { status: true } },
        _count: { select: { requisitions: true } },
      },
    }),
    prisma.event.findMany({
      where: statsWhere,
      select: {
        startsAt: true,
        estimatedGuests: true,
        confirmedGuests: true,
        requirements: { select: { status: true } },
      },
    }),
  ]);

  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);

  const stats = statRows.reduce(
    (acc, event) => {
      if (event.startsAt < sevenDays) acc.next7 += 1;
      if (event.startsAt < thirtyDays) {
        acc.next30 += 1;
        acc.guestsNext30 +=
          event.confirmedGuests > 0 ? event.confirmedGuests : event.estimatedGuests;
      }
      acc.pendingRequirements += event.requirements.filter((requirement) =>
        PENDING_REQUIREMENT_STATUSES.includes(requirement.status)
      ).length;
      return acc;
    },
    { next7: 0, next30: 0, guestsNext30: 0, pendingRequirements: 0 }
  );

  return {
    filters,
    businesses: scope.viewBusinesses,
    userScope: {
      role: scope.role,
      canViewPrivate: scope.canViewPrivate,
      hasBusinessScope: scope.businessIds.length > 0,
      canCreateEvents: EVENT_CREATE_ROLES.includes(scope.role),
      canViewFinancials: EVENT_FINANCIAL_ROLES.includes(scope.role),
    },
    stats,
    events: rows.map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      estimatedGuests: event.estimatedGuests,
      confirmedGuests: event.confirmedGuests,
      locationName: event.locationName,
      isPrivate: event.isPrivate,
      business: event.business,
      locationBusiness: event.locationBusiness,
      createdBy: event.createdBy,
      responsibleUser: event.responsibleUser,
      requirementsTotal: event.requirements.length,
      requirementsPending: event.requirements.filter((requirement) =>
        PENDING_REQUIREMENT_STATUSES.includes(requirement.status)
      ).length,
      requirementsReady: event.requirements.filter(
        (requirement) => requirement.status === EventRequirementStatus.READY
      ).length,
      requisitionsCount: event._count.requisitions,
      paymentTiming: event.paymentTiming,
      paymentStatus: event.paymentStatus,
      quotedAmountCents: event.quotedAmountCents,
      paidAmountCents: event.paidAmountCents,
      paymentDueAt: event.paymentDueAt,
    })),
  };
}

export async function getEventCreateData(eventId?: string): Promise<EventCreateData> {
  const scope = await resolveEventScope();

  if (!EVENT_CREATE_ROLES.includes(scope.role)) {
    throw new Error("No tienes permisos para crear eventos.");
  }

  const userWhere: Prisma.UserWhereInput = {
    isActive: true,
    ...(GLOBAL_BUSINESS_ROLES.includes(scope.role)
      ? {}
      : {
          OR: [
            { id: scope.userId },
            { businessId: { in: scope.businessIds } },
            { primaryBusinessId: { in: scope.businessIds } },
            { businessAccess: { some: { businessId: { in: scope.businessIds } } } },
          ],
        }),
  };

  const requisitionWhere: Prisma.RequisitionWhereInput = {
    ...(eventId ? { OR: [{ eventId: null }, { eventId }] } : { eventId: null }),
    status: {
      in: [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "ORDERED",
        "RECEIVED_PARTIAL",
        "RECEIVED",
      ],
    },
    ...(GLOBAL_BUSINESS_ROLES.includes(scope.role)
      ? {}
      : { businessId: { in: scope.businessIds } }),
  };

  const [creator, responsibleUsers, requisitions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: scope.userId },
      select: { id: true, fullName: true, role: true, primaryBusinessId: true },
    }),
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
        role: true,
        primaryBusinessId: true,
        businessId: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.requisition.findMany({
      where: requisitionWhere,
      select: {
        id: true,
        title: true,
        status: true,
        kind: true,
        neededBy: true,
        eventId: true,
        business: { select: { id: true, name: true } },
      },
      orderBy: [{ neededBy: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  if (!creator) throw new Error("No se encontró el usuario activo.");
  if (scope.businesses.length === 0) {
    throw new Error("No tienes negocios disponibles para registrar el evento.");
  }

  const defaultBusinessId =
    creator.primaryBusinessId && scope.businessIds.includes(creator.primaryBusinessId)
      ? creator.primaryBusinessId
      : scope.businesses[0].id;

  return {
    canCreateRequisition: REQUISITION_CREATE_ROLES.includes(scope.role),
    creator: {
      id: creator.id,
      fullName: creator.fullName,
      role: creator.role,
    },
    defaultBusinessId,
    businesses: scope.businesses,
    responsibleUsers,
    requisitions: requisitions.map((requisition) => ({
      ...requisition,
      neededBy: requisition.neededBy?.toISOString() ?? null,
    })),
  };
}

function toMexicoLocalInput(date: Date | null, includeTime = true): string {
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: includeTime ? "2-digit" : undefined,
    minute: includeTime ? "2-digit" : undefined,
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const datePart = `${part("year")}-${part("month")}-${part("day")}`;
  return includeTime ? `${datePart}T${part("hour")}:${part("minute")}` : datePart;
}

export type EventDetailData = {
  event: {
    id: string;
    title: string;
    eventType: string | null;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    estimatedGuests: number;
    confirmedGuests: number;
    locationName: string | null;
    locationAddress: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    description: string | null;
    internalNotes: string | null;
    isPrivate: boolean;
    paymentTiming: string;
    paymentStatus: string;
    quotedAmountCents: number;
    paidAmountCents: number;
    paymentDueAt: Date | null;
    paymentNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    business: { id: string; name: string };
    locationBusiness: { id: string; name: string } | null;
    createdBy: { id: string; fullName: string; role: string };
    responsibleUser: { id: string; fullName: string; role: string } | null;
    requirements: Array<{
      id: string;
      category: string | null;
      description: string;
      quantity: number | null;
      unit: string | null;
      status: string;
      neededBy: Date | null;
      notes: string | null;
      responsibleUser: { id: string; fullName: string } | null;
    }>;
    requisitions: Array<{
      id: string;
      title: string;
      status: string;
      kind: string;
      priority: string;
      neededBy: Date | null;
      requiresSeparatePayment: boolean;
      createdBy: { id: string; fullName: string };
      itemCount: number;
      estimatedTotalCents: number;
    }>;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canCreateRequisition: boolean;
    canViewFinancials: boolean;
  };
};

export async function getEventDetailData(eventId: string): Promise<EventDetailData | null> {
  const scope = await resolveEventScope();

  const event = await prisma.event.findFirst({
    where: {
      AND: [{ id: eventId }, scope.visibilityWhere, scope.privacyWhere],
    },
    select: {
      id: true,
      title: true,
      eventType: true,
      status: true,
      startsAt: true,
      endsAt: true,
      estimatedGuests: true,
      confirmedGuests: true,
      locationName: true,
      locationAddress: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      description: true,
      internalNotes: true,
      isPrivate: true,
      paymentTiming: true,
      paymentStatus: true,
      quotedAmountCents: true,
      paidAmountCents: true,
      paymentDueAt: true,
      paymentNotes: true,
      createdAt: true,
      updatedAt: true,
      business: { select: { id: true, name: true } },
      locationBusiness: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true, role: true } },
      responsibleUser: { select: { id: true, fullName: true, role: true } },
      requirements: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          category: true,
          description: true,
          quantity: true,
          unit: true,
          status: true,
          neededBy: true,
          notes: true,
          responsibleUser: { select: { id: true, fullName: true } },
        },
      },
      requisitions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          kind: true,
          priority: true,
          neededBy: true,
          requiresSeparatePayment: true,
          createdBy: { select: { id: true, fullName: true } },
          items: {
            select: { qtyRequested: true, estimatedPriceCents: true },
          },
        },
      },
    },
  });

  if (!event) return null;

  const canManageBusiness =
    GLOBAL_BUSINESS_ROLES.includes(scope.role) ||
    scope.businessIds.includes(event.business.id) ||
    Boolean(event.locationBusiness && scope.businessIds.includes(event.locationBusiness.id));
  const isDirectlyInvolved =
    event.createdBy.id === scope.userId || event.responsibleUser?.id === scope.userId;
  const canEdit =
    EVENT_CREATE_ROLES.includes(scope.role) && (canManageBusiness || isDirectlyInvolved);
  const canDelete =
    canEdit &&
    (PRIVATE_EVENT_ROLES.includes(scope.role) ||
      (event.createdBy.id === scope.userId && ["DRAFT", "TENTATIVE"].includes(event.status)));

  return {
    event: {
      ...event,
      requisitions: event.requisitions.map(({ items, ...requisition }) => ({
        ...requisition,
        itemCount: items.length,
        estimatedTotalCents: items.reduce(
          (total, item) => total + item.qtyRequested * item.estimatedPriceCents,
          0
        ),
      })),
    },
    permissions: {
      canEdit,
      canDelete,
      canCreateRequisition: REQUISITION_CREATE_ROLES.includes(scope.role),
      canViewFinancials: EVENT_FINANCIAL_ROLES.includes(scope.role),
    },
  };
}

export async function getEventEditPageData(eventId: string): Promise<{
  data: EventCreateData;
  initialEvent: EventFormInitialData;
} | null> {
  const detail = await getEventDetailData(eventId);
  if (!detail) return null;
  if (!detail.permissions.canEdit) {
    throw new Error("No tienes permisos para editar este evento.");
  }

  const data = await getEventCreateData(eventId);
  const event = detail.event;

  const initialEvent: EventFormInitialData = {
    id: event.id,
    createdBy: {
      fullName: event.createdBy.fullName,
      role: event.createdBy.role,
    },
    title: event.title,
    eventType: event.eventType ?? "",
    status: event.status as EventFormInitialData["status"],
    businessId: event.business.id,
    locationBusinessId: event.locationBusiness?.id ?? "",
    locationName: event.locationName ?? "",
    locationAddress: event.locationAddress ?? "",
    startsAtLocal: toMexicoLocalInput(event.startsAt),
    endsAtLocal: toMexicoLocalInput(event.endsAt),
    estimatedGuests: event.estimatedGuests,
    confirmedGuests: event.confirmedGuests,
    contactName: event.contactName ?? "",
    contactPhone: event.contactPhone ?? "",
    contactEmail: event.contactEmail ?? "",
    responsibleUserId: event.responsibleUser?.id ?? "",
    description: event.description ?? "",
    internalNotes: event.internalNotes ?? "",
    isPrivate: event.isPrivate,
    paymentTiming: event.paymentTiming as EventFormInitialData["paymentTiming"],
    paymentStatus: event.paymentStatus as EventFormInitialData["paymentStatus"],
    quotedAmount: event.quotedAmountCents / 100,
    paidAmount: event.paidAmountCents / 100,
    paymentDueLocal: toMexicoLocalInput(event.paymentDueAt, false),
    paymentNotes: event.paymentNotes ?? "",
    requisitionIds: event.requisitions.map((requisition) => requisition.id),
    requirements: event.requirements.map((requirement) => ({
      id: requirement.id,
      category: requirement.category ?? "",
      description: requirement.description,
      quantity: requirement.quantity,
      unit: requirement.unit ?? "",
      responsibleUserId: requirement.responsibleUser?.id ?? "",
      neededByLocal: toMexicoLocalInput(requirement.neededBy),
      notes: requirement.notes ?? "",
    })),
  };

  return { data, initialEvent };
}

export type UpcomingEventsCardItem = {
  id: string;
  title: string;
  status: string;
  startsAt: Date;
  estimatedGuests: number;
  confirmedGuests: number;
  locationName: string | null;
  business: { id: string; name: string };
  locationBusiness: { id: string; name: string } | null;
  responsibleUser: { id: string; fullName: string } | null;
  requirementsPending: number;
  requisitionsCount: number;
};

export type UpcomingEventsCardData = {
  canCreateEvents: boolean;
  totalUpcoming: number;
  next30: number;
  events: UpcomingEventsCardItem[];
};

/**
 * Resumen liviano para insertar la agenda de eventos en cualquier dashboard.
 * Muestra la agenda general de todos los negocios a todos los puestos.
 * Los eventos marcados como privados conservan su restricción de privacidad.
 */
export async function getUpcomingEventsCardData(
  requestedLimit = 4
): Promise<UpcomingEventsCardData> {
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 6);
  const scope = await resolveEventScope();
  const today = mexicoTodayStart();
  const thirtyDays = addDays(today, 30);

  const commonWhere: Prisma.EventWhereInput = {
    AND: [
      scope.visibilityWhere,
      scope.privacyWhere,
      { startsAt: { gte: today } },
      { status: { in: ACTIVE_EVENT_STATUSES } },
    ],
  };

  const [rows, totalUpcoming, next30] = await Promise.all([
    prisma.event.findMany({
      where: commonWhere,
      orderBy: { startsAt: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        estimatedGuests: true,
        confirmedGuests: true,
        locationName: true,
        business: { select: { id: true, name: true } },
        locationBusiness: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, fullName: true } },
        requirements: { select: { status: true } },
        _count: { select: { requisitions: true } },
      },
    }),
    prisma.event.count({ where: commonWhere }),
    prisma.event.count({
      where: {
        AND: [commonWhere, { startsAt: { lt: thirtyDays } }],
      },
    }),
  ]);

  return {
    canCreateEvents: EVENT_CREATE_ROLES.includes(scope.role),
    totalUpcoming,
    next30,
    events: rows.map((event) => ({
      id: event.id,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt,
      estimatedGuests: event.estimatedGuests,
      confirmedGuests: event.confirmedGuests,
      locationName: event.locationName,
      business: event.business,
      locationBusiness: event.locationBusiness,
      responsibleUser: event.responsibleUser,
      requirementsPending: event.requirements.filter((requirement) =>
        PENDING_REQUIREMENT_STATUSES.includes(requirement.status)
      ).length,
      requisitionsCount: event._count.requisitions,
    })),
  };
}

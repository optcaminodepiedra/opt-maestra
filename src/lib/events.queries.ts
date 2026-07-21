import "server-only";

import { EventRequirementStatus, EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";

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
  responsibleUser: { id: string; fullName: string } | null;
  requirementsTotal: number;
  requirementsPending: number;
  requirementsReady: number;
  requisitionsCount: number;
};

export type EventDashboardData = {
  filters: EventDashboardFilters;
  businesses: { id: string; name: string }[];
  userScope: {
    role: string;
    canViewPrivate: boolean;
    hasBusinessScope: boolean;
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

  const businesses = await prisma.business.findMany({
    where: isGlobalBusiness ? undefined : { id: { in: businessIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (isGlobalBusiness) businessIds = businesses.map((business) => business.id);

  const visibilityWhere: Prisma.EventWhereInput = isGlobalBusiness
    ? {}
    : {
        OR: [
          ...(businessIds.length > 0
            ? [
                { businessId: { in: businessIds } },
                { locationBusinessId: { in: businessIds } },
              ]
            : []),
          { createdById: userId },
          { responsibleUserId: userId },
        ],
      };

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

  const selectedBusinessId = scope.businessIds.includes(filters.businessId)
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
        business: { select: { id: true, name: true } },
        locationBusiness: { select: { id: true, name: true } },
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
    businesses: scope.businesses,
    userScope: {
      role: scope.role,
      canViewPrivate: scope.canViewPrivate,
      hasBusinessScope: scope.businessIds.length > 0,
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
      responsibleUser: event.responsibleUser,
      requirementsTotal: event.requirements.length,
      requirementsPending: event.requirements.filter((requirement) =>
        PENDING_REQUIREMENT_STATUSES.includes(requirement.status)
      ).length,
      requirementsReady: event.requirements.filter(
        (requirement) => requirement.status === EventRequirementStatus.READY
      ).length,
      requisitionsCount: event._count.requisitions,
    })),
  };
}

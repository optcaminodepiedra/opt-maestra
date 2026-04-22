import { prisma } from "@/lib/prisma";
import { getTeamUserIds, type ManagerScope } from "@/lib/manager-scope";

/* ═══════════════════════════ Inventario ═══════════════════════════ */

export async function loadManagerInventory(scope: ManagerScope, selectedBusinessId?: string | null) {
  const businessFilter = selectedBusinessId
    ? { businessId: selectedBusinessId }
    : { businessId: { in: scope.businessIds } };

  const items = await prisma.inventoryItem.findMany({
    where: { ...businessFilter, isActive: true },
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
      businessId: true,
      business: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    category: i.category,
    unit: i.unit,
    onHandQty: i.onHandQty,
    minQty: i.minQty,
    lastPriceCents: i.lastPriceCents,
    supplierName: i.supplierName,
    businessId: i.businessId,
    businessName: i.business.name,
  }));
}

/* ═══════════════════════════ Requisiciones ═══════════════════════════ */

export async function loadManagerRequisitions(
  scope: ManagerScope,
  selectedBusinessId?: string | null
) {
  const businessFilter = selectedBusinessId
    ? { businessId: selectedBusinessId }
    : { businessId: { in: scope.businessIds } };

  // Requisiciones que el gerente o su equipo crearon para sus negocios
  const requisitions = await prisma.requisition.findMany({
    where: {
      ...businessFilter,
      // Solo las que creó este gerente o alguien en sus negocios
      // (Para globals, todas)
      ...(scope.isGlobal ? {} : { createdById: scope.userId }),
    },
    include: {
      business: { select: { name: true } },
      items: {
        select: {
          qtyRequested: true,
          estimatedPriceCents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return requisitions.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    note: r.note,
    neededBy: r.neededBy,
    createdAt: r.createdAt,
    businessName: r.business.name,
    itemsCount: r.items.length,
    estimatedTotalCents: r.items.reduce(
      (sum, it) => sum + it.qtyRequested * it.estimatedPriceCents,
      0
    ),
  }));
}

/* ═══════════════════════════ Finanzas ═══════════════════════════ */

export async function loadManagerFinances(
  scope: ManagerScope,
  selectedBusinessId?: string | null
) {
  const businessFilter = selectedBusinessId
    ? { businessId: selectedBusinessId }
    : { businessId: { in: scope.businessIds } };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [salesToday, salesMonthAgg, expensesRecent, expensesMonthAgg, withdrawalsRecent, withdrawalsLargePending, withdrawalsPettyTodayAgg] = await Promise.all([
    prisma.sale.findMany({
      where: { ...businessFilter, createdAt: { gte: today } },
      include: {
        user: { select: { fullName: true } },
        cashpoint: { select: { name: true } },
        business: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.sale.aggregate({
      where: { ...businessFilter, createdAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
    }),
    prisma.expense.findMany({
      where: { ...businessFilter, createdAt: { gte: startOfMonth } },
      include: {
        user: { select: { fullName: true } },
        business: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.expense.aggregate({
      where: { ...businessFilter, createdAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
    }),
    prisma.withdrawal.findMany({
      where: businessFilter,
      include: {
        cashpoint: { select: { name: true } },
        business: { select: { name: true } },
        requestedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.withdrawal.count({
      where: { ...businessFilter, status: "REQUESTED" },
    }),
    prisma.withdrawal.aggregate({
      where: {
        ...businessFilter,
        kind: "PETTY_CASH",
        status: "APPROVED",
        createdAt: { gte: today },
      },
      _sum: { amountCents: true },
    }),
  ]);

  // Breakdown por método
  const salesTodayByMethod = {
    CASH: 0,
    CARD: 0,
    TRANSFER: 0,
  };
  for (const s of salesToday) {
    salesTodayByMethod[s.method] += s.amountCents;
  }

  return {
    salesToday: salesToday.map((s) => ({
      id: s.id,
      amountCents: s.amountCents,
      method: s.method,
      concept: s.concept,
      createdAt: s.createdAt,
      userName: s.user.fullName,
      cashpointName: s.cashpoint.name,
      businessName: s.business.name,
    })),
    salesMonthTotalCents: salesMonthAgg._sum.amountCents ?? 0,
    salesTodayByMethod,
    expensesRecent: expensesRecent.map((e) => ({
      id: e.id,
      amountCents: e.amountCents,
      category: e.category,
      note: e.note,
      createdAt: e.createdAt,
      userName: e.user.fullName,
      businessName: e.business.name,
    })),
    expensesMonthTotalCents: expensesMonthAgg._sum.amountCents ?? 0,
    withdrawalsRecent: withdrawalsRecent.map((w) => ({
      id: w.id,
      amountCents: w.amountCents,
      reason: w.reason,
      status: w.status,
      kind: w.kind,
      createdAt: w.createdAt,
      cashpointName: w.cashpoint?.name ?? null,
      businessName: w.business.name,
      requestedByName: w.requestedBy.fullName,
    })),
    withdrawalsPettyTodayCents: withdrawalsPettyTodayAgg._sum.amountCents ?? 0,
    withdrawalsLargePendingCount: withdrawalsLargePending,
  };
}

/* ═══════════════════════════ Payroll ═══════════════════════════ */

export async function loadManagerPayroll(
  scope: ManagerScope,
  selectedBusinessId?: string | null
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDbDate = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");

  const businessIds = selectedBusinessId ? [selectedBusinessId] : scope.businessIds;

  // Traer empleados del equipo
  const team = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { businessId: { in: businessIds } },
        { primaryBusinessId: { in: businessIds } },
        { businessAccess: { some: { businessId: { in: businessIds } } } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      primaryBusinessId: true,
      businessId: true,
      primaryBusiness: { select: { name: true } },
      business: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  const teamIds = team.map((t) => t.id);

  const [workDays, scheduledShifts] = await Promise.all([
    prisma.workDay.findMany({
      where: {
        userId: { in: teamIds },
        date: todayDbDate,
      },
      include: {
        punches: {
          orderBy: { timestamp: "asc" },
        },
      },
    }),
    prisma.scheduledShift.findMany({
      where: {
        userId: { in: teamIds },
        date: todayDbDate,
        businessId: { in: businessIds },
      },
    }),
  ]);

  return {
    team: team.map((t) => ({
      userId: t.id,
      fullName: t.fullName,
      jobTitle: t.jobTitle,
      businessName: t.primaryBusiness?.name ?? t.business?.name ?? "Sin negocio",
    })),
    workDays: workDays.map((w) => {
      // Detectar si está en pausa (último punch fue INICIO_COMIDA o INICIO_COMPRAS sin cierre)
      const last = w.punches[w.punches.length - 1];
      const isOnBreak = last
        ? last.type === "INICIO_COMIDA" || last.type === "INICIO_COMPRAS"
        : false;
      const first = w.punches[0];
      return {
        userId: w.userId,
        status: w.status,
        totalMinutes: w.totalMinutes,
        firstPunchTime: first
          ? new Date(first.timestamp).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        lastPunchTime: last
          ? new Date(last.timestamp).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        isOnBreak,
      };
    }),
    scheduledShifts: scheduledShifts.map((s) => ({
      userId: s.userId,
      startTime: s.startTime,
      endTime: s.endTime,
      role: s.role,
      status: s.status,
    })),
  };
}

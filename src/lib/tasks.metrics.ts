"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus, TaskType } from "@prisma/client";

export type TaskProgressSummary = {
  totals: Record<TaskStatus, number> & { ALL: number };
  byBusiness: Array<{
    businessId: string | null;
    businessName: string;
    totals: Record<TaskStatus, number> & { ALL: number };
  }>;
  byAssigned: Array<{
    userId: string | null;
    userName: string;
    totals: Record<TaskStatus, number> & { ALL: number };
  }>;
};

const statuses: TaskStatus[] = ["TODO", "DOING", "BLOCKED", "DONE"];

function emptyTotals() {
  return {
    TODO: 0,
    DOING: 0,
    BLOCKED: 0,
    DONE: 0,
    ALL: 0,
  };
}

export async function getTaskProgressSummary(type: TaskType): Promise<TaskProgressSummary> {
  // 1) Totales por status
  const totalsRows = await prisma.task.groupBy({
    by: ["status"],
    where: { type },
    _count: { _all: true },
  });

  const totals = emptyTotals();
  for (const row of totalsRows) {
    totals[row.status] = row._count._all;
    totals.ALL += row._count._all;
  }

  // 2) Por unidad (businessId + status)
  const byBusinessRows = await prisma.task.groupBy({
    by: ["businessId", "status"],
    where: { type },
    _count: { _all: true },
  });

  // Vamos a necesitar nombres de Business
  const businessIds = Array.from(
    new Set(byBusinessRows.map((r) => r.businessId).filter(Boolean))
  ) as string[];

  const businesses = businessIds.length
    ? await prisma.business.findMany({
        where: { id: { in: businessIds } },
        select: { id: true, name: true },
      })
    : [];

  const bizNameMap = new Map<string, string>(businesses.map((b) => [b.id, b.name]));

  const bizTotalsMap = new Map<string | null, ReturnType<typeof emptyTotals>>();
  for (const row of byBusinessRows) {
    const key = row.businessId ?? null;
    if (!bizTotalsMap.has(key)) bizTotalsMap.set(key, emptyTotals());
    const t = bizTotalsMap.get(key)!;
    t[row.status] += row._count._all;
    t.ALL += row._count._all;
  }

  const byBusiness = Array.from(bizTotalsMap.entries())
    .map(([businessId, t]) => ({
      businessId,
      businessName: businessId ? bizNameMap.get(businessId) ?? "Unidad" : "Sin unidad",
      totals: t,
    }))
    .sort((a, b) => b.totals.ALL - a.totals.ALL);

  // 3) Por asignado (assignedId + status)
  const byAssignedRows = await prisma.task.groupBy({
    by: ["assignedId", "status"],
    where: { type },
    _count: { _all: true },
  });

  const userIds = Array.from(
    new Set(byAssignedRows.map((r) => r.assignedId).filter(Boolean))
  ) as string[];

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
    : [];

  const userNameMap = new Map<string, string>(users.map((u) => [u.id, u.fullName]));

  const userTotalsMap = new Map<string | null, ReturnType<typeof emptyTotals>>();
  for (const row of byAssignedRows) {
    const key = row.assignedId ?? null;
    if (!userTotalsMap.has(key)) userTotalsMap.set(key, emptyTotals());
    const t = userTotalsMap.get(key)!;
    t[row.status] += row._count._all;
    t.ALL += row._count._all;
  }

  const byAssigned = Array.from(userTotalsMap.entries())
    .map(([userId, t]) => ({
      userId,
      userName: userId ? userNameMap.get(userId) ?? "Usuario" : "Sin asignar",
      totals: t,
    }))
    .sort((a, b) => b.totals.ALL - a.totals.ALL);

  // Asegurar que existan todas las keys por status (por si alguien no tiene filas)
  for (const s of statuses) {
    totals[s] = totals[s] ?? 0;
  }

  return { totals, byBusiness, byAssigned };
}

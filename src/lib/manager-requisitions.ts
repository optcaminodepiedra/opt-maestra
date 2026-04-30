import { prisma } from "@/lib/prisma";

export async function loadMyRequisitions(userId: string, limit = 15) {
  const requisitions = await prisma.requisition.findMany({
    where: { createdById: userId },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  return requisitions.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    eventName: r.eventName,
    status: r.status,
    priority: r.priority,
    itemCount: r._count.items,
    createdAt: r.createdAt.toISOString(),
  }));
}

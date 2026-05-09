import { prisma } from "@/lib/prisma";

/**
 * Resuelve el businessId activo para las páginas del restaurante.
 *
 * Prioridad:
 *   1. Query param explícito (?businessId=X)
 *   2. primaryBusinessId del usuario, SI tiene mesas
 *   3. Negocio con más mesas activas (default global)
 *
 * Retorna null si no hay ningún negocio con mesas.
 */
export async function resolveRestaurantBusinessId(input: {
  queryBusinessId?: string;
  userPrimaryBusinessId?: string | null;
}): Promise<string | null> {
  // 1. Query explícito siempre gana
  if (input.queryBusinessId) {
    // Verificar que el negocio existe (por seguridad)
    const exists = await prisma.business.findUnique({
      where: { id: input.queryBusinessId },
      select: { id: true },
    });
    if (exists) return input.queryBusinessId;
  }

  // 2. primaryBusinessId del usuario, solo si tiene mesas activas
  if (input.userPrimaryBusinessId) {
    const hasMesas = await prisma.restaurantTable.findFirst({
      where: { businessId: input.userPrimaryBusinessId, isActive: true },
      select: { id: true },
    });
    if (hasMesas) return input.userPrimaryBusinessId;
  }

  // 3. Negocio con más mesas activas
  const top = await prisma.restaurantTable.groupBy({
    by: ["businessId"],
    where: { isActive: true },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  return top[0]?.businessId ?? null;
}

/**
 * Lista todos los negocios que tienen mesas activas (para el selector).
 */
export async function listRestaurantOptions() {
  const grouped = await prisma.restaurantTable.groupBy({
    by: ["businessId"],
    where: { isActive: true },
    _count: { id: true },
  });

  if (grouped.length === 0) return [];

  const businessIds = grouped.map((g) => g.businessId);
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true },
  });

  // Combinar y ordenar por cantidad de mesas (descendente)
  const options = grouped
    .map((g) => {
      const b = businesses.find((x) => x.id === g.businessId);
      return {
        id: g.businessId,
        name: b?.name ?? "(sin nombre)",
        tableCount: g._count.id,
      };
    })
    .sort((a, b) => b.tableCount - a.tableCount);

  return options;
}

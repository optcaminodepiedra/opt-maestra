import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

/**
 * Resuelve el businessId activo, **respetando los permisos del usuario**.
 *
 * Prioridad:
 *   1. Query param `?businessId=X` → solo si el user tiene acceso
 *   2. primaryBusinessId del usuario, si tiene mesas
 *   3. Primer negocio (alfabético por nombre) al que el user tiene acceso y tenga mesas
 *
 * Retorna null si el usuario no tiene acceso a ningún restaurante con mesas.
 */
export async function resolveRestaurantBusinessId(input: {
  queryBusinessId?: string;
  userId: string;
  userRole: string;
  userPrimaryBusinessId?: string | null;
}): Promise<string | null> {
  const isAdmin = ADMIN_ROLES.includes(input.userRole);

  // Obtener lista de IDs accesibles
  const accessibleIds = await getAccessibleBusinessIds(input.userId, input.userRole);

  // 1. Query explícito gana, pero validar acceso
  if (input.queryBusinessId) {
    const allowed = isAdmin || accessibleIds.includes(input.queryBusinessId);
    if (!allowed) {
      // El usuario está intentando acceder a un negocio sin permiso → retornar null
      return null;
    }
    // Verificar que el negocio existe
    const exists = await prisma.business.findUnique({
      where: { id: input.queryBusinessId },
      select: { id: true },
    });
    if (exists) return input.queryBusinessId;
  }

  // 2. primaryBusinessId si tiene mesas Y el user tiene acceso
  if (input.userPrimaryBusinessId) {
    const allowed = isAdmin || accessibleIds.includes(input.userPrimaryBusinessId);
    if (allowed) {
      const hasMesas = await prisma.restaurantTable.findFirst({
        where: { businessId: input.userPrimaryBusinessId, isActive: true },
        select: { id: true },
      });
      if (hasMesas) return input.userPrimaryBusinessId;
    }
  }

  // 3. Primer negocio accesible con mesas (alfabético)
  if (isAdmin) {
    // Admin: buscar el negocio con más mesas globalmente
    const top = await prisma.restaurantTable.groupBy({
      by: ["businessId"],
      where: { isActive: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });
    return top[0]?.businessId ?? null;
  } else {
    // Usuario normal: solo entre los accesibles
    if (accessibleIds.length === 0) return null;

    const withMesas = await prisma.restaurantTable.findMany({
      where: { businessId: { in: accessibleIds }, isActive: true },
      select: { businessId: true, business: { select: { name: true } } },
      distinct: ["businessId"],
    });

    if (withMesas.length === 0) return null;

    // Ordenar alfabéticamente por nombre del negocio
    withMesas.sort((a, b) => (a.business?.name ?? "").localeCompare(b.business?.name ?? ""));
    return withMesas[0].businessId;
  }
}

/**
 * Lista todos los negocios accesibles para el usuario que tienen mesas activas.
 * Para admins: todos los negocios con mesas.
 * Para usuarios normales: solo los que tienen acceso explícito (UserBusinessAccess + primaryBusinessId).
 */
export async function listRestaurantOptions(
  userId: string,
  userRole: string
): Promise<Array<{ id: string; name: string; tableCount: number }>> {
  const isAdmin = ADMIN_ROLES.includes(userRole);

  let businessIdsFilter: string[] | null = null;
  if (!isAdmin) {
    businessIdsFilter = await getAccessibleBusinessIds(userId, userRole);
    if (businessIdsFilter.length === 0) return [];
  }

  const grouped = await prisma.restaurantTable.groupBy({
    by: ["businessId"],
    where: {
      isActive: true,
      ...(businessIdsFilter ? { businessId: { in: businessIdsFilter } } : {}),
    },
    _count: { id: true },
  });

  if (grouped.length === 0) return [];

  const businessIds = grouped.map((g) => g.businessId);
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true },
  });

  const options = grouped
    .map((g) => {
      const b = businesses.find((x) => x.id === g.businessId);
      return {
        id: g.businessId,
        name: b?.name ?? "(sin nombre)",
        tableCount: g._count.id,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return options;
}

/**
 * Verifica si un usuario tiene acceso a un negocio específico.
 * Usado por server actions para validar antes de mutar.
 */
export async function userCanAccessBusiness(
  userId: string,
  userRole: string,
  businessId: string
): Promise<boolean> {
  if (ADMIN_ROLES.includes(userRole)) return true;
  const ids = await getAccessibleBusinessIds(userId, userRole);
  return ids.includes(businessId);
}

/**
 * Obtiene todos los businessIds accesibles para un usuario:
 *   - su primaryBusinessId
 *   - los businessIds de UserBusinessAccess
 */
async function getAccessibleBusinessIds(userId: string, userRole: string): Promise<string[]> {
  if (ADMIN_ROLES.includes(userRole)) {
    const all = await prisma.business.findMany({ select: { id: true } });
    return all.map((b) => b.id);
  }

  const [user, accesses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryBusinessId: true },
    }),
    prisma.userBusinessAccess.findMany({
      where: { userId },
      select: { businessId: true },
    }),
  ]);

  const ids = new Set<string>();
  if (user?.primaryBusinessId) ids.add(user.primaryBusinessId);
  for (const a of accesses) ids.add(a.businessId);

  return Array.from(ids);
}

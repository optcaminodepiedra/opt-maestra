import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { redirect } from "next/navigation";

export type ManagerScope = {
  userId: string;
  userName: string;
  role: string;
  businessIds: string[];
  businesses: { id: string; name: string; linkedHotelBusinessId: string | null }[];
  isGlobal: boolean;        // MASTER_ADMIN/OWNER/SUPERIOR ven todo
  managerKind: "ops" | "restaurant" | "ranch" | "hotel" | "generic";
  primarySection: string;   // ruta base: "/app/manager/ops", etc.
};

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const MANAGER_ROLES = [
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER",
];

/**
 * Resuelve el scope completo del gerente actual.
 * Si no es manager ni global, redirige al dashboard por defecto.
 *
 * @param enforceManagerKind - Si se pasa, verifica que el rol coincida. Si no coincide,
 * redirige a la sección correcta del usuario.
 */
export async function resolveManagerScope(
  enforceManagerKind?: "ops" | "restaurant" | "ranch"
): Promise<ManagerScope> {
  const me = await getMe();
  const role = me.role as string;
  const userId = (me as any).id as string;

  if (!GLOBAL_ROLES.includes(role) && !MANAGER_ROLES.includes(role)) {
    redirect("/app");
  }

  const isGlobal = GLOBAL_ROLES.includes(role);

  // Determinar qué tipo de gerente es y su sección
  let managerKind: ManagerScope["managerKind"] = "generic";
  let primarySection = "/app/manager";
  switch (role) {
    case "MANAGER_OPS":
      managerKind = "ops";
      primarySection = "/app/manager/ops";
      break;
    case "MANAGER_RESTAURANT":
      managerKind = "restaurant";
      primarySection = "/app/manager/restaurant";
      break;
    case "MANAGER_RANCH":
      managerKind = "ranch";
      primarySection = "/app/manager/ranch";
      break;
    case "MANAGER_HOTEL":
      managerKind = "hotel";
      primarySection = "/app/hotel";
      break;
    case "MANAGER":
      managerKind = "generic";
      primarySection = "/app/manager/ops"; // legado va a ops
      break;
  }

  // Si se forzó una sección específica y el gerente es de otra kind, redirigir
  if (enforceManagerKind && !isGlobal && managerKind !== enforceManagerKind && managerKind !== "generic") {
    redirect(primarySection);
  }

  // Resolver businessIds
  let businessIds: string[] = [];
  if (isGlobal) {
    // Globals ven todo pero les damos ventana de todos los negocios activos
    const all = await prisma.business.findMany({ select: { id: true } });
    businessIds = all.map((b) => b.id);
  } else {
    const primaryId = (me as any).primaryBusinessId as string | null;
    if (primaryId) businessIds.push(primaryId);

    try {
      const access = await prisma.$queryRaw<{ businessId: string }[]>`
        SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
      `;
      for (const a of access) {
        if (!businessIds.includes(a.businessId)) businessIds.push(a.businessId);
      }
    } catch {
      /* tabla puede no existir */
    }
  }

  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true, linkedHotelBusinessId: true },
    orderBy: { name: "asc" },
  });

  return {
    userId,
    userName: (me as any).name ?? (me as any).fullName ?? "Gerente",
    role,
    businessIds,
    businesses,
    isGlobal,
    managerKind,
    primarySection,
  };
}

/**
 * Verifica que el usuario actual tenga acceso al negocio indicado.
 * Lanza error si no. Para uso en server actions.
 */
export async function requireBusinessAccess(businessId: string): Promise<ManagerScope> {
  const scope = await resolveManagerScope();
  if (scope.isGlobal) return scope;
  if (!scope.businessIds.includes(businessId)) {
    throw new Error("No tienes acceso a ese negocio.");
  }
  return scope;
}

/**
 * Construye el conjunto de IDs de usuarios que pertenecen a los negocios gestionados.
 * Útil para filtrar WorkDay, tareas asignadas, etc.
 */
export async function getTeamUserIds(scope: ManagerScope): Promise<string[]> {
  if (scope.businessIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { businessId: { in: scope.businessIds } },
        { primaryBusinessId: { in: scope.businessIds } },
        { businessAccess: { some: { businessId: { in: scope.businessIds } } } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

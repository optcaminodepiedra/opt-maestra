import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const INVENTORY_ROLES = ["INVENTORY"];

export type RequisitionFilter = {
  kind?: string[];           // ["RESTAURANT", "SPECIAL_EVENT"]
  status?: string[];         // ["SUBMITTED", "APPROVED"]
  businessId?: string;
  priority?: "NORMAL" | "URGENT";
  onlyMine?: boolean;        // solo las que yo creé
};

/**
 * Lista requisiciones aplicando scope de visibilidad:
 * - Gerentes: solo las que ELLOS crearon
 * - Goyo (INVENTORY): ve todas excepto OWNER_HOUSE (a menos que sea admin)
 * - Admins: ven todo incluyendo OWNER_HOUSE
 *
 * Para listar OWNER_HOUSE específicamente, usar el flag `kind: ["OWNER_HOUSE"]`
 * y la función verificará permisos.
 */
export async function listRequisitions(filter: RequisitionFilter = {}) {
  const me = await getMe();
  const role = me.role as string;
  const userId = (me as any).id as string;

  const isAdmin = GLOBAL_ROLES.includes(role);
  const isInventory = INVENTORY_ROLES.includes(role);

  // Construir where con privacidad
  const where: any = {};

  // Filtros del usuario
  if (filter.kind && filter.kind.length > 0) where.kind = { in: filter.kind };
  if (filter.status && filter.status.length > 0) where.status = { in: filter.status };
  if (filter.businessId) where.businessId = filter.businessId;
  if (filter.priority) where.priority = filter.priority;

  // Reglas de scope
  if (filter.onlyMine) {
    // Cualquiera puede pedir "solo las mías"
    where.createdById = userId;
  } else if (isAdmin) {
    // Admins ven todo, sin restricciones
  } else if (isInventory) {
    // Goyo ve todas las que NO son privadas
    // Excepto si está pidiendo específicamente OWNER_HOUSE (que también es Goyo el responsable)
    if (filter.kind?.includes("OWNER_HOUSE")) {
      // permitir, Goyo es el dueño de OWNER_HOUSE también
    } else {
      where.isPrivate = false;
    }
  } else {
    // Gerentes y demás: solo ven las que ellos crearon
    where.createdById = userId;
  }

  return prisma.requisition.findMany({
    where,
    include: {
      business: { select: { name: true } },
      createdBy: { select: { fullName: true, role: true } },
      deliveredBy: { select: { fullName: true } },
      receivedBy: { select: { fullName: true } },
      items: {
        include: {
          item: { select: { name: true, unit: true } },
        },
      },
      accountsPayable: { select: { id: true, status: true, amountCents: true } },
    },
    orderBy: [
      { priority: "desc" },  // urgentes primero
      { createdAt: "desc" },
    ],
    take: 200,
  });
}

/**
 * Obtiene una requisición por ID validando permisos.
 */
export async function getRequisitionById(id: string) {
  const me = await getMe();
  const role = me.role as string;
  const userId = (me as any).id as string;

  const req = await prisma.requisition.findUnique({
    where: { id },
    include: {
      business: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true, role: true } },
      deliveredBy: { select: { fullName: true } },
      receivedBy: { select: { fullName: true } },
      items: {
        include: {
          item: { select: { name: true, unit: true, sku: true } },
        },
      },
      accountsPayable: true,
    },
  });

  if (!req) return null;

  const isAdmin = GLOBAL_ROLES.includes(role);
  const isInventory = INVENTORY_ROLES.includes(role);
  const isOwner = req.createdBy.id === userId;

  // Validar permiso de visibilidad
  if (!isAdmin && !isOwner) {
    if (isInventory) {
      // Goyo no puede ver privadas si no es admin
      if (req.isPrivate) {
        return null;
      }
    } else {
      // Otros roles solo ven las suyas
      return null;
    }
  }

  return req;
}

/**
 * Cuenta requisiciones pendientes para mostrar en sidebar/dashboards.
 */
export async function countPendingRequisitions(): Promise<number> {
  const me = await getMe();
  const role = me.role as string;
  const userId = (me as any).id as string;

  const isAdmin = GLOBAL_ROLES.includes(role);
  const isInventory = INVENTORY_ROLES.includes(role);

  const where: any = {
    status: { in: ["SUBMITTED", "APPROVED", "ORDERED"] },
  };

  if (isAdmin) {
    // sin restricción
  } else if (isInventory) {
    where.isPrivate = false;
  } else {
    where.createdById = userId;
  }

  return prisma.requisition.count({ where });
}

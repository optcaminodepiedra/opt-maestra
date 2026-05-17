import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";

/**
 * IDs de los hoteles soportados por el módulo Hotel.
 * Filtrar por ID es más robusto que filtrar por nombre.
 */
export const HOTEL_BUSINESS_IDS = [
  "cmn27irvz0000uzuch34h6ed0", // Hotel Camino de Piedra
  "cmn27isfi0001uzucove504j8", // Tierra Adentro Hotel Fashion Grill & Spa
  "cmn27isqr0002uzucjka5fqwy", // Rancho El Milagrito
] as const;

// Mantenemos el allowlist por nombre como fallback / referencia legible
export const HOTEL_BUSINESS_ALLOWLIST = [
  "Rancho El Milagrito",
  "Hotel Camino de Piedra",
  "Tierra Adentro Hotel Fashion Grill & Spa",
];

const GLOBAL_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Devuelve los hoteles que el usuario actual puede ver.
 *
 * - Roles globales (MASTER_ADMIN/OWNER/SUPERIOR) → ven los 3 hoteles
 * - Otros roles → solo los hoteles a los que tienen acceso:
 *   * `primaryBusinessId` si es hotel
 *   * `businessId` (legacy) si es hotel
 *   * `UserBusinessAccess` que sean hoteles
 *   * Hotel vinculado via `linkedHotelBusinessId` de cualquier negocio accesible
 *     (Bodega 4 → CdP, Restaurante TA → TA, Cantina → Rancho, etc.)
 */
export async function getHotelBusinesses() {
  // 1) Cargar todos los hoteles válidos (por ID + fallback por nombre)
  const allHotels = await prisma.business.findMany({
    where: {
      OR: [
        { id: { in: HOTEL_BUSINESS_IDS as unknown as string[] } },
        ...HOTEL_BUSINESS_ALLOWLIST.map((name) => ({
          name: { contains: name, mode: "insensitive" as const },
        })),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Deduplicar por id (por si OR matchea por dos rutas)
  const seen = new Set<string>();
  const hotels = allHotels.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  // 2) Resolver el usuario actual
  let me: any = null;
  try {
    me = await getMe();
  } catch {
    return [];
  }
  if (!me) return [];

  const role = me.role as string;

  // 3) Globals ven todos los hoteles
  if (GLOBAL_ROLES.includes(role)) {
    return hotels;
  }

  // 4) Para roles normales: calcular qué hoteles puede ver
  const userId = me.id as string;
  const accessibleBusinessIds = new Set<string>();

  if (me.primaryBusinessId) accessibleBusinessIds.add(me.primaryBusinessId);
  if (me.businessId) accessibleBusinessIds.add(me.businessId);

  // UserBusinessAccess
  try {
    const access = await prisma.userBusinessAccess.findMany({
      where: { userId },
      select: { businessId: true },
    });
    for (const a of access) accessibleBusinessIds.add(a.businessId);
  } catch {
    /* tabla puede no existir en ambientes viejos */
  }

  // Hoteles vinculados desde negocios accesibles (ej. Bodega 4 → CdP)
  if (accessibleBusinessIds.size > 0) {
    const linked = await prisma.business.findMany({
      where: {
        id: { in: Array.from(accessibleBusinessIds) },
        linkedHotelBusinessId: { not: null },
      },
      select: { linkedHotelBusinessId: true },
    });
    for (const b of linked) {
      if (b.linkedHotelBusinessId) accessibleBusinessIds.add(b.linkedHotelBusinessId);
    }
  }

  // 5) Filtrar hoteles a los accesibles
  return hotels.filter((h) => accessibleBusinessIds.has(h.id));
}

/**
 * Versión sincrónica (legacy / backwards compat).
 * Si conoces el usuario, prefiere usar `pickDefaultHotelForUser`.
 */
export function pickDefaultHotelBusinessId(
  businesses: { id: string; name: string }[]
): string | null {
  if (!businesses || businesses.length === 0) return null;
  if (businesses.length === 1) return businesses[0].id;

  const prefer = ["Camino de Piedra", "Tierra Adentro", "Milagrito"];
  for (const p of prefer) {
    const hit = businesses.find((b) => norm(b.name).includes(norm(p)));
    if (hit) return hit.id;
  }
  return businesses[0]?.id ?? null;
}

/**
 * Decide el hotel default basado en el usuario actual.
 *
 * Prioridad:
 * 1. Globals → el primer hotel con habitaciones (evita arrancar en uno vacío)
 * 2. Si `primaryBusinessId` ES un hotel → ese
 * 3. Si `primaryBusinessId` tiene `linkedHotelBusinessId` → ese hotel vinculado
 * 4. Si `businessId` (legacy) ES un hotel → ese
 * 5. El primer hotel disponible con habitaciones activas
 * 6. El primero a secas
 *
 * Casos resueltos:
 * - Claudia (MANAGER_OPS, primary = Restaurante TA → linked Hotel TA) → TA
 * - Iris (MANAGER_RANCH, primary = Rancho) → Rancho
 * - Tania (MANAGER_HOTEL, primary = Hotel CdP) → CdP
 * - Admin → el primero con habitaciones (no un hotel vacío)
 */
export async function pickDefaultHotelForUser(
  businesses: { id: string; name: string }[]
): Promise<string | null> {
  if (!businesses || businesses.length === 0) return null;
  if (businesses.length === 1) return businesses[0].id;

  let me: any = null;
  try {
    me = await getMe();
  } catch {
    return pickDefaultHotelBusinessId(businesses);
  }
  if (!me) return pickDefaultHotelBusinessId(businesses);

  const role = me.role as string;
  const hotelIds = new Set(businesses.map((b) => b.id));

  // Globals: primer hotel con habitaciones
  if (GLOBAL_ROLES.includes(role)) {
    return await pickFirstWithRooms(businesses);
  }

  // 1) primary ES hotel
  if (me.primaryBusinessId && hotelIds.has(me.primaryBusinessId)) {
    return me.primaryBusinessId;
  }

  // 2) primary tiene linked hotel visible
  if (me.primaryBusinessId) {
    const primary = await prisma.business.findUnique({
      where: { id: me.primaryBusinessId },
      select: { linkedHotelBusinessId: true },
    });
    if (primary?.linkedHotelBusinessId && hotelIds.has(primary.linkedHotelBusinessId)) {
      return primary.linkedHotelBusinessId;
    }
  }

  // 3) businessId legacy ES hotel
  if (me.businessId && hotelIds.has(me.businessId)) {
    return me.businessId;
  }

  // 4) Primer hotel con habitaciones
  return await pickFirstWithRooms(businesses);
}

async function pickFirstWithRooms(
  businesses: { id: string; name: string }[]
): Promise<string | null> {
  for (const b of businesses) {
    const count = await prisma.hotelRoom.count({
      where: { businessId: b.id, isActive: true },
    });
    if (count > 0) return b.id;
  }
  return businesses[0]?.id ?? null;
}

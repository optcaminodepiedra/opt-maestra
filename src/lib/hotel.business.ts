import { prisma } from "@/lib/prisma";

/**
 * IDs de los hoteles soportados por el módulo Hotel.
 * Filtrar por ID es más robusto que filtrar por nombre (que puede tener
 * variaciones de mayúsculas, acentos, sufijos, etc).
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

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Devuelve los hoteles soportados por el módulo Hotel.
 * Usa filtro por ID (más confiable) + fallback por nombre por si los IDs
 * cambian en algún ambiente.
 */
export async function getHotelBusinesses() {
  const all = await prisma.business.findMany({
    where: {
      OR: [
        { id: { in: HOTEL_BUSINESS_IDS as unknown as string[] } },
        // Fallback por nombre — match en ambas direcciones
        ...HOTEL_BUSINESS_ALLOWLIST.flatMap((name) => [
          { name: { contains: name, mode: "insensitive" as const } },
          // y al revés: si el nombre BD es más corto y el allowlist contiene el nombre BD
        ]),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Deduplicar por id (por si OR hace match por dos rutas)
  const seen = new Set<string>();
  return all.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

export function pickDefaultHotelBusinessId(businesses: { id: string; name: string }[]) {
  // prioridad: Camino, Tierra, Rancho
  const prefer = ["Camino de Piedra", "Tierra Adentro", "Milagrito"];
  for (const p of prefer) {
    const hit = businesses.find((b) => norm(b.name).includes(norm(p)));
    if (hit) return hit.id;
  }
  return businesses[0]?.id ?? null;
}
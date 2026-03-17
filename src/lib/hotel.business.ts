import { prisma } from "@/lib/prisma";

export const HOTEL_BUSINESS_ALLOWLIST = [
  "Rancho El Milagrito",
  "Hotel Camino de Piedra",
  "Tierra Adentro Hotel Fashion Grill & Spa",
];

// comparación “suave” por si hay variaciones de mayúsculas/espacios
function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

// match por “contiene” para tolerar nombres ligeramente distintos
function isAllowedHotelBusinessName(name: string) {
  const n = norm(name);
  return HOTEL_BUSINESS_ALLOWLIST.some((x) => n.includes(norm(x)));
}

export async function getHotelBusinesses() {
  const all = await prisma.business.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return all.filter((b) => isAllowedHotelBusinessName(b.name));
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
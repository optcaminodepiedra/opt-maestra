import { prisma } from "@/lib/prisma";
import { dateOnly, isoDate } from "@/lib/schedule";

export type FoodServiceDay = {
  dateIso: string;
  label: string;        // "Hoy", "Mié 23", etc.
  pax: number;          // personas que consumirán alimentos ese día
  reservationsCount: number;
  intensity: "none" | "low" | "normal" | "high" | "very_high";
};

/**
 * Para un hotel dado, cuenta cuántas personas consumirán alimentos cada día
 * en los próximos N días.
 *
 * Una reserva "abarca" un día D si:
 *   checkIn <= D  Y  checkOut > D  (checkOut excluido: ese día ya se fue)
 * Y sólo si hasFoodService = true.
 */
export async function getFoodServicePax(
  hotelBusinessId: string,
  daysAhead: number = 7
): Promise<FoodServiceDay[]> {
  const today = dateOnly(isoDate());
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + daysAhead);

  // Traemos reservas que se traslapan con la ventana y tienen alimentos
  const reservations = await prisma.hotelReservation.findMany({
    where: {
      businessId: hotelBusinessId,
      hasFoodService: true,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      // Traslape con la ventana:
      AND: [
        { checkIn: { lt: end } },
        { checkOut: { gt: today } },
      ],
    },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      foodServicePax: true,
    },
  });

  // Construir los N días
  const days: FoodServiceDay[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dayIso = isoDate(d);

    // Contar reservas que cubren este día
    let pax = 0;
    let count = 0;
    for (const r of reservations) {
      const rCheckIn = new Date(r.checkIn);
      const rCheckOut = new Date(r.checkOut);
      // Normalizar a fecha sin horas para comparar
      rCheckIn.setUTCHours(0, 0, 0, 0);
      rCheckOut.setUTCHours(0, 0, 0, 0);
      const dayDate = dateOnly(dayIso);

      if (rCheckIn <= dayDate && rCheckOut > dayDate) {
        // foodServicePax tiene prioridad; si no está, suma adults+children
        pax += r.foodServicePax ?? (r.adults + r.children);
        count++;
      }
    }

    days.push({
      dateIso: dayIso,
      label: buildLabel(d, i),
      pax,
      reservationsCount: count,
      intensity: intensityFor(pax),
    });
  }

  return days;
}

function buildLabel(d: Date, idx: number): string {
  if (idx === 0) return "Hoy";
  if (idx === 1) return "Mañana";
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
}

function intensityFor(pax: number): FoodServiceDay["intensity"] {
  if (pax === 0) return "none";
  if (pax <= 4) return "low";
  if (pax <= 10) return "normal";
  if (pax <= 20) return "high";
  return "very_high";
}

/**
 * Total de reservas con alimentos activas para hoy (para KPI rápido).
 */
export async function getTodayFoodReservationsCount(hotelBusinessId: string): Promise<{
  count: number;
  pax: number;
}> {
  const today = dateOnly(isoDate());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const reservations = await prisma.hotelReservation.findMany({
    where: {
      businessId: hotelBusinessId,
      hasFoodService: true,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      checkIn: { lt: tomorrow },
      checkOut: { gt: today },
    },
    select: { adults: true, children: true, foodServicePax: true },
  });

  let pax = 0;
  for (const r of reservations) {
    pax += r.foodServicePax ?? (r.adults + r.children);
  }

  return { count: reservations.length, pax };
}
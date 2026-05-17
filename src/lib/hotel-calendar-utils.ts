/**
 * Helpers para el calendario tipo Airbnb.
 * Maneja zona horaria México y cálculos de posición de barras.
 */

export function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  const aMid = startOfDayLocal(a).getTime();
  const bMid = startOfDayLocal(b).getTime();
  return Math.round((bMid - aMid) / 86400000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

const WEEKDAY_LABELS_ES = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MONTH_LABELS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatWeekdayShort(date: Date): string {
  return WEEKDAY_LABELS_ES[date.getDay()];
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_LABELS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Para una vista de mes, devuelve un rango con buffer antes/después.
 */
export function getMonthViewRange(monthDate: Date, bufferDays: number = 7): { from: Date; to: Date } {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstOfNextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  return {
    from: addDays(firstOfMonth, -bufferDays),
    to: addDays(firstOfNextMonth, bufferDays),
  };
}

/**
 * Convierte ISO/Date a Date local.
 */
export function parseReservationDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
}

/**
 * Cálculo posición de barra de reserva (mediodía-a-mediodía).
 *
 * Esto resuelve el bug visual: una estadía vie→sáb se ve como UNA barra
 * que cruza solo UNA noche (entre el medio del viernes y el medio del sábado).
 */
export function calculateBarPosition(
  checkIn: Date,
  checkOut: Date,
  viewStartDate: Date,
  totalDays: number,
  dayWidth: number
): { leftPx: number; widthPx: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const viewStart = startOfDayLocal(viewStartDate);
  const viewEnd = addDays(viewStart, totalDays);

  if (checkOut <= viewStart || checkIn >= viewEnd) return null;

  const startOffset = daysBetween(viewStart, startOfDayLocal(checkIn));
  const endOffset = daysBetween(viewStart, startOfDayLocal(checkOut));

  let startPx = (startOffset + 0.5) * dayWidth;
  let endPx = (endOffset + 0.5) * dayWidth;

  const minPx = 0;
  const maxPx = totalDays * dayWidth;
  const clippedStart = startPx < minPx;
  const clippedEnd = endPx > maxPx;

  startPx = Math.max(minPx, startPx);
  endPx = Math.min(maxPx, endPx);

  return {
    leftPx: startPx,
    widthPx: Math.max(8, endPx - startPx),
    clippedStart, clippedEnd,
  };
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return daysBetween(startOfDayLocal(checkIn), startOfDayLocal(checkOut));
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateInputValue(value: string, hour: number = 12): Date {
  const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

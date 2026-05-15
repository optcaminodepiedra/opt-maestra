/**
 * Helpers de fechas para análisis con timezone México.
 *
 * México: America/Mexico_City, UTC-6 sin DST (desde 2022).
 *
 * Convenciones:
 *  - "rango" = [from, to) — from inclusive, to exclusive
 *  - Internamente todo Date (UTC) pero representando fronteras MX
 *  - Para queries Prisma, usar createdAt: { gte: from, lt: to }
 */

export type DateRange = {
  from: Date;     // inclusive
  to: Date;       // exclusive
  label: string;  // texto humano: "Hoy", "Esta semana", etc.
};

export type ComparisonMode = "prev_period" | "prev_year" | "none";

export type PresetKey =
  | "today" | "yesterday" | "last7days" | "thisweek" | "thismonth"
  | "lastmonth" | "last3months" | "thisyear" | "lastyear" | "custom";

/** Fecha actual en zona México (UTC-6 fijo, sin DST). */
export function nowMexico(): { year: number; month: number; day: number; hour: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Construye Date UTC representando "yyyy-mm-dd 00:00 MX" (UTC-6 → suma 6h). */
export function mxDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
}

function isoWeekday(date: { year: number; month: number; day: number }): number {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function getPresetRange(preset: PresetKey, customFrom?: Date, customTo?: Date): DateRange {
  const now = nowMexico();
  switch (preset) {
    case "today":
      return { from: mxDate(now.year, now.month, now.day), to: mxDate(now.year, now.month, now.day + 1), label: "Hoy" };
    case "yesterday":
      return { from: mxDate(now.year, now.month, now.day - 1), to: mxDate(now.year, now.month, now.day), label: "Ayer" };
    case "last7days":
      return { from: mxDate(now.year, now.month, now.day - 6), to: mxDate(now.year, now.month, now.day + 1), label: "Últimos 7 días" };
    case "thisweek": {
      const dow = isoWeekday(now);
      return {
        from: mxDate(now.year, now.month, now.day - (dow - 1)),
        to: mxDate(now.year, now.month, now.day - (dow - 1) + 7),
        label: "Esta semana",
      };
    }
    case "thismonth":
      return { from: mxDate(now.year, now.month, 1), to: mxDate(now.year, now.month + 1, 1), label: "Este mes" };
    case "lastmonth":
      return { from: mxDate(now.year, now.month - 1, 1), to: mxDate(now.year, now.month, 1), label: "Mes pasado" };
    case "last3months":
      return { from: mxDate(now.year, now.month - 2, 1), to: mxDate(now.year, now.month + 1, 1), label: "Últimos 3 meses" };
    case "thisyear":
      return { from: mxDate(now.year, 1, 1), to: mxDate(now.year + 1, 1, 1), label: "Este año" };
    case "lastyear":
      return { from: mxDate(now.year - 1, 1, 1), to: mxDate(now.year, 1, 1), label: "Año pasado" };
    case "custom":
      if (!customFrom || !customTo) return getPresetRange("today");
      return {
        from: customFrom, to: customTo,
        label: `${formatDateShort(customFrom)} – ${formatDateShort(new Date(customTo.getTime() - 86400000))}`,
      };
  }
}

export function getComparisonRange(range: DateRange, mode: ComparisonMode): DateRange | null {
  if (mode === "none") return null;
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();
  const durationMs = toMs - fromMs;

  if (mode === "prev_period") {
    return { from: new Date(fromMs - durationMs), to: new Date(fromMs), label: "Período anterior" };
  }
  if (mode === "prev_year") {
    const fromYearAgo = new Date(range.from);
    fromYearAgo.setUTCFullYear(fromYearAgo.getUTCFullYear() - 1);
    const toYearAgo = new Date(range.to);
    toYearAgo.setUTCFullYear(toYearAgo.getUTCFullYear() - 1);
    return { from: fromYearAgo, to: toYearAgo, label: "Hace 1 año" };
  }
  return null;
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City",
  });
}

export function formatDateForChart(d: Date, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    return d.toLocaleDateString("es-MX", { month: "short", year: "2-digit", timeZone: "America/Mexico_City" });
  }
  if (granularity === "week") return `Sem ${getWeekNumber(d)}`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function toMxDateString(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

export function fromMxDateString(s: string): Date {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return mxDate(y, m, d);
}

export function suggestGranularity(range: DateRange): "day" | "week" | "month" {
  const days = (range.to.getTime() - range.from.getTime()) / 86400000;
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

export function defaultComparisonFor(preset: PresetKey): ComparisonMode {
  switch (preset) {
    case "today": case "yesterday": case "thisweek": case "last7days":
    case "thismonth": case "lastmonth": case "last3months":
      return "prev_period";
    case "thisyear": case "lastyear":
      return "prev_year";
    default:
      return "none";
  }
}

export const PRESET_OPTIONS: Array<{ key: PresetKey; label: string }> = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "last7days", label: "Últimos 7 días" },
  { key: "thisweek", label: "Esta semana" },
  { key: "thismonth", label: "Este mes" },
  { key: "lastmonth", label: "Mes pasado" },
  { key: "last3months", label: "Últimos 3 meses" },
  { key: "thisyear", label: "Este año" },
  { key: "lastyear", label: "Año pasado" },
  { key: "custom", label: "Personalizado" },
];

/**
 * Helper para resolver los filtros de analytics desde URL searchParams.
 *
 * Convención de URL params:
 *  - preset=today|thismonth|... (default: thismonth)
 *  - from=YYYY-MM-DD, to=YYYY-MM-DD (solo si preset=custom)
 *  - biz=id1,id2,id3 (default: todos los del manager)
 *  - compare=prev_period|prev_year|none (default: según preset)
 */

import {
  getPresetRange, getComparisonRange, defaultComparisonFor, fromMxDateString,
  type DateRange, type ComparisonMode, type PresetKey,
} from "@/lib/date-presets";

export type AnalyticsFilters = {
  preset: PresetKey;
  customFromIso: string | undefined;
  customToIso: string | undefined;
  range: DateRange;
  comparisonMode: ComparisonMode;
  comparisonRange: DateRange | null;
  selectedBusinessIds: string[];        // Lo que se va a usar para filtrar queries
  selectedBusinessIdsFromUrl: string[]; // [] = todos del manager
};

export function resolveAnalyticsFilters(
  searchParams: Record<string, string | undefined>,
  allManagerBusinessIds: string[]
): AnalyticsFilters {
  // Preset
  const presetParam = (searchParams.preset ?? "thismonth") as PresetKey;
  const validPresets: PresetKey[] = [
    "today", "yesterday", "last7days", "thisweek", "thismonth",
    "lastmonth", "last3months", "thisyear", "lastyear", "custom",
  ];
  const preset: PresetKey = validPresets.includes(presetParam) ? presetParam : "thismonth";

  // Custom range
  const customFromIso = searchParams.from;
  const customToIso = searchParams.to;
  let customFrom: Date | undefined;
  let customTo: Date | undefined;
  if (preset === "custom" && customFromIso && customToIso) {
    customFrom = fromMxDateString(customFromIso);
    // to es exclusive — sumar 1 día porque el usuario eligió "hasta inclusive"
    const toInclusive = fromMxDateString(customToIso);
    customTo = new Date(toInclusive.getTime() + 86400000);
  }

  const range = getPresetRange(preset, customFrom, customTo);

  // Comparación
  const compareParam = (searchParams.compare ?? "auto") as ComparisonMode | "auto";
  let comparisonMode: ComparisonMode;
  if (compareParam === "auto" || compareParam === undefined) {
    comparisonMode = defaultComparisonFor(preset);
  } else if (compareParam === "prev_period" || compareParam === "prev_year" || compareParam === "none") {
    comparisonMode = compareParam;
  } else {
    comparisonMode = defaultComparisonFor(preset);
  }

  const comparisonRange = getComparisonRange(range, comparisonMode);

  // Negocios seleccionados
  const bizParam = searchParams.biz;
  const selectedBusinessIdsFromUrl = bizParam
    ? bizParam.split(",").filter((id) => allManagerBusinessIds.includes(id))
    : [];
  const selectedBusinessIds = selectedBusinessIdsFromUrl.length > 0
    ? selectedBusinessIdsFromUrl
    : allManagerBusinessIds;

  return {
    preset,
    customFromIso,
    customToIso,
    range,
    comparisonMode,
    comparisonRange,
    selectedBusinessIds,
    selectedBusinessIdsFromUrl,
  };
}

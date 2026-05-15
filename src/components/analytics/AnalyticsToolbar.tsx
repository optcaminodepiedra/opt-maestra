"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, GitCompareArrows } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { BusinessMultiSelect } from "./BusinessMultiSelect";
import { formatDateShort, type PresetKey, type ComparisonMode } from "@/lib/date-presets";

type Props = {
  preset: PresetKey;
  customFromIso?: string;
  customToIso?: string;
  comparisonMode: ComparisonMode;
  range: { from: Date; to: Date; label: string };
  comparisonRange: { from: Date; to: Date; label: string } | null;
  allBusinesses: Array<{ id: string; name: string }>;
  selectedBusinessIdsFromUrl: string[];
  /** Si false, no muestra selector de negocios (cuando solo hay 1). */
  showBusinessSelector?: boolean;
  /** Children opcionales para inyectar botones extra (export, etc.) */
  children?: React.ReactNode;
};

export function AnalyticsToolbar({
  preset, customFromIso, customToIso,
  comparisonMode, range, comparisonRange,
  allBusinesses, selectedBusinessIdsFromUrl,
  showBusinessSelector = true,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  function setCompareMode(mode: ComparisonMode | "auto") {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "auto") params.delete("compare");
    else params.set("compare", mode);
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  const compareLabel = {
    prev_period: "Período anterior",
    prev_year: "Hace 1 año",
    none: "Sin comparar",
  }[comparisonMode];

  return (
    <div className="bg-card border rounded-lg p-3 flex flex-wrap items-center gap-2">
      {/* Período */}
      <DateRangePicker
        currentPreset={preset}
        customFromIso={customFromIso}
        customToIso={customToIso}
      />

      {/* Negocios */}
      {showBusinessSelector && allBusinesses.length > 1 && (
        <BusinessMultiSelect
          allBusinesses={allBusinesses}
          selectedIds={selectedBusinessIdsFromUrl}
        />
      )}

      {/* Comparación */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <GitCompareArrows className="w-3.5 h-3.5 mr-1.5" />
            {compareLabel}
            <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setCompareMode("prev_period")}>
            Período anterior
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCompareMode("prev_year")}>
            Hace 1 año
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCompareMode("none")}>
            Sin comparar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}

      {/* Resumen del rango */}
      <div className="w-full flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
        <Badge variant="secondary" className="text-[10px]">
          {range.label}: {formatDateShort(range.from)} → {formatDateShort(new Date(range.to.getTime() - 86400000))}
        </Badge>
        {comparisonRange && (
          <Badge variant="outline" className="text-[10px]">
            vs {comparisonRange.label}: {formatDateShort(comparisonRange.from)} → {formatDateShort(new Date(comparisonRange.to.getTime() - 86400000))}
          </Badge>
        )}
      </div>
    </div>
  );
}

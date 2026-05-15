"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { PRESET_OPTIONS, type PresetKey, getPresetRange, toMxDateString } from "@/lib/date-presets";

type Props = {
  /** Preset actual (sincronizado con URL). */
  currentPreset: PresetKey;
  /** Para custom: from y to en formato YYYY-MM-DD. */
  customFromIso?: string;
  customToIso?: string;
  /** Si true, usa router.push; si false, llama onChange (modo controlado). */
  syncToUrl?: boolean;
  onChange?: (preset: PresetKey, customFrom?: string, customTo?: string) => void;
};

export function DateRangePicker({
  currentPreset,
  customFromIso,
  customToIso,
  syncToUrl = true,
  onChange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(customFromIso ?? toMxDateString(new Date()));
  const [customTo, setCustomTo] = useState(customToIso ?? toMxDateString(new Date()));

  const currentLabel = PRESET_OPTIONS.find((p) => p.key === currentPreset)?.label ?? "Período";

  function updateUrl(preset: PresetKey, from?: string, to?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", preset);
    if (preset === "custom" && from && to) {
      params.set("from", from);
      params.set("to", to);
    } else {
      params.delete("from");
      params.delete("to");
    }
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSelect(preset: PresetKey) {
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    if (syncToUrl) updateUrl(preset);
    else onChange?.(preset);
  }

  function handleApplyCustom() {
    if (syncToUrl) updateUrl("custom", customFrom, customTo);
    else onChange?.("custom", customFrom, customTo);
    setCustomOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
            {currentPreset === "custom" && customFromIso && customToIso
              ? `${customFromIso} → ${customToIso}`
              : currentLabel}
            <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {PRESET_OPTIONS.slice(0, 4).map((opt) => (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={currentPreset === opt.key ? "bg-accent" : ""}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {PRESET_OPTIONS.slice(4, 8).map((opt) => (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={currentPreset === opt.key ? "bg-accent" : ""}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {PRESET_OPTIONS.slice(8).map((opt) => (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={currentPreset === opt.key ? "bg-accent" : ""}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {currentPreset === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">Editar fechas</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full mt-1 px-2 py-1 text-sm border rounded"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta (inclusive)</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full mt-1 px-2 py-1 text-sm border rounded"
              />
            </div>
            <Button size="sm" className="w-full" onClick={handleApplyCustom}>
              Aplicar
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

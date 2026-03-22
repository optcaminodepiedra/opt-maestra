"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { CalendarDateRangePicker } from "@/components/ui/date-range-picker";

type Biz = { id: string; name: string };

export function OwnerFiltersBar({
  businesses,
}: {
  businesses: Biz[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const businessId = sp.get("businessId") || "all";
  
  // Leemos las fechas exactas desde la URL
  const fromParam = sp.get("from");
  const toParam = sp.get("to");

  const options = useMemo(() => [{ id: "all", name: "Todas las unidades" }, ...businesses], [businesses]);

  // Convertimos el texto de la URL en fechas para el calendario
  const date: DateRange | undefined = useMemo(() => {
    if (fromParam) {
      return {
        from: new Date(`${fromParam}T00:00:00`),
        to: toParam ? new Date(`${toParam}T23:59:59`) : undefined,
      };
    }
    return undefined;
  }, [fromParam, toParam]);

  // Cuando el usuario elige una nueva fecha en el calendario, actualizamos la URL
  function setDate(newDate: DateRange | undefined) {
    const next = new URLSearchParams(sp.toString());
    next.delete("range"); // Borramos el filtro viejo ("7d", "month") si existía

    if (newDate?.from) {
      next.set("from", format(newDate.from, "yyyy-MM-dd"));
    } else {
      next.delete("from");
    }

    if (newDate?.to) {
      next.set("to", format(newDate.to, "yyyy-MM-dd"));
    } else {
      next.delete("to");
    }

    router.push(`${pathname}?${next.toString()}`);
  }

  // Cuando cambia la sucursal
  function setBusiness(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (!value || value === "all") next.delete("businessId");
    else next.set("businessId", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-lg border bg-card p-3 shadow-sm">
      {/* Selector de Fechas */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">Periodo:</span>
        <CalendarDateRangePicker date={date} setDate={setDate} />
      </div>

      {/* Selector de Sucursal */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Unidad:</span>
        <select
          className="h-10 w-full md:w-[220px] rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
          value={businessId}
          onChange={(e) => setBusiness(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
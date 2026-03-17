"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Biz = { id: string; name: string };

export function OwnerFiltersBar({
  businesses,
  defaultPreset = "30d",
}: {
  businesses: Biz[];
  defaultPreset?: "today" | "7d" | "30d" | "ytd";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const preset = (sp.get("range") as any) || defaultPreset;
  const businessId = sp.get("businessId") || "all";

  const options = useMemo(() => [{ id: "all", name: "Todas" }, ...businesses], [businesses]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Tabs value={preset} onValueChange={(v) => setParam("range", v)} className="w-full md:w-auto">
        <TabsList>
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="7d">7 días</TabsTrigger>
          <TabsTrigger value="30d">30 días</TabsTrigger>
          <TabsTrigger value="ytd">YTD</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">Unidad</div>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={businessId}
          onChange={(e) => setParam("businessId", e.target.value)}
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

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BusinessLite = { id: string; name: string };

type Props = {
  businesses: BusinessLite[];
  initialBusinessId: string | null;
  initialPreset: "today" | "7d" | "30d" | "ytd";
};

export function SalesFilters({ businesses, initialBusinessId, initialPreset }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // estado local para que el Select se sienta instantáneo
  const [businessId, setBusinessId] = useState<string>(initialBusinessId ?? "all");
  const [preset, setPreset] = useState<Props["initialPreset"]>(initialPreset);

  const businessOptions = useMemo(
    () => [{ id: "all", name: "Todas las unidades" }, ...businesses],
    [businesses]
  );

  function pushQuery(next: { businessId: string; preset: Props["initialPreset"] }) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");

    // preset siempre
    sp.set("preset", next.preset);

    // businessId opcional
    if (next.businessId === "all") sp.delete("businessId");
    else sp.set("businessId", next.businessId);

    startTransition(() => {
      router.push(`/app/owner/sales?${sp.toString()}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Filtros</CardTitle>
        <div className="text-xs text-muted-foreground">
          Selecciona unidad y rango. (Hoy / 7 días / 30 días / YTD)
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-2">
        {/* Unidad */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Unidad</div>
          <Select
            value={businessId}
            onValueChange={(val) => {
              setBusinessId(val);
              pushQuery({ businessId: val, preset });
            }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona unidad" />
            </SelectTrigger>
            <SelectContent>
              {businessOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rango */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Rango</div>
          <Select
            value={preset}
            onValueChange={(val) => {
              const v = val as Props["initialPreset"];
              setPreset(v);
              pushQuery({ businessId, preset: v });
            }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona rango" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="ytd">Año a la fecha (YTD)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isPending ? (
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Actualizando…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

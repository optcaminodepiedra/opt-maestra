"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTable } from "@/lib/restaurant.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Data = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  cashpoints: { id: string; name: string }[];
  selectedCashpointId?: string | null;
  tables: Array<{
    id: string;
    name: string;
    capacity: number;
    area?: string | null;
    cashpointId?: string | null;
    isActive: boolean;
  }>;
};

export function TablesManager({
  data,
  me,
}: {
  data: Data;
  me: { role: string; allowedToSwitch: boolean };
}) {
  const router = useRouter();
  const businesses = data?.businesses ?? [];
  const cashpoints = data?.cashpoints ?? [];
  const tables = data?.tables ?? [];

  const [businessId, setBusinessId] = React.useState<string>(data?.businessId ?? "");
  const [cashpointId, setCashpointId] = React.useState<string>(data?.selectedCashpointId ?? "");

  // alta
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("4");
  const [area, setArea] = React.useState("");

  function onBusinessChange(id: string) {
    setBusinessId(id);
    setCashpointId("");
    router.push(`/app/restaurant/tables?businessId=${id}`);
  }

function onCashpointChange(id: string) {
  const real = id === "__GENERAL__" ? "" : id;
  setCashpointId(real);
  router.push(
    real
      ? `/app/restaurant/tables?businessId=${businessId}&cashpointId=${real}`
      : `/app/restaurant/tables?businessId=${businessId}`
  );
}

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    await createTable({
  businessId,
  cashpointId: cashpointId || null, // ✅ MUY IMPORTANTE
  name: name.trim(),
  capacity: Math.max(1, parseInt(capacity || "4", 10) || 4),
  area: area.trim() || undefined,
  sortOrder: 0,
});

    setName("");
    setCapacity("4");
    setArea("");
    router.refresh();
  }

  if (!businessId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mesas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No hay unidad seleccionada (o no hay unidades en BD).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuración</CardTitle>
            <Badge variant="secondary">Por unidad</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {me.allowedToSwitch ? (
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={businessId} onValueChange={onBusinessChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona unidad" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Unidad fija (staff).</div>
          )}

          <div className="space-y-2">
            <Label>Filtro por caja/local (opcional)</Label>
            <Select value={cashpointId} onValueChange={onCashpointChange}>
              <SelectTrigger>
                <SelectValue placeholder="(Opcional) filtrar por caja" />
              </SelectTrigger>
              <SelectContent>
                {cashpoints.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Si eliges caja/local, el listado de mesas se filtra por ese scope (y las compartidas).
            </div>
          </div>

          <Separator />

          <form className="space-y-3" onSubmit={onCreate}>
            <div className="space-y-2">
              <Label>Nombre de mesa</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. M1 / Terraza 1" />
            </div>

            <div className="space-y-2">
              <Label>Capacidad</Label>
              <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" />
            </div>

            <div className="space-y-2">
              <Label>Área (opcional)</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ej. Terraza / Interior" />
            </div>

            <Button className="w-full" type="submit" disabled={!name.trim()}>
              Agregar mesa
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Listado</CardTitle>
            <Badge variant="secondary">{tables.length} mesas</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {tables.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay mesas en este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tables.map((t) => (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">Cap: {t.capacity}</div>
                  {t.area ? <div className="text-xs text-muted-foreground">Área: {t.area}</div> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function mxn(cents: number) {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

type Data = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  kpis: null | {
    totalRooms: number;
    occupancyPct: number;
    available: number;
    occupied: number;
    dirty: number;
    cleaning: number;
    outOfService: number;
    dayRevenueCents: number;
    weekRevenueCents: number;
  };
  arrivalsToday: any[];
  departuresToday: any[];
  alerts: Array<{ type: string; text: string }>;
};

export function HotelDashboard({
  data,
  me,
}: {
  data: Data;
  me: { role: string; allowedToSwitch: boolean };
}) {
  const router = useRouter();
  const businesses = data.businesses ?? [];
  const bid = data.businessId ?? "";
  const k = data.kpis;

  function onBusinessChange(id: string) {
    router.push(`/app/hotel/dashboard?businessId=${id}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Contexto</CardTitle>
            {me.allowedToSwitch ? (
              <div className="w-72">
                <Select value={bid} onValueChange={onBusinessChange}>
                  <SelectTrigger><SelectValue placeholder="Selecciona negocio" /></SelectTrigger>
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
              <Badge variant="secondary">Unidad fija</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Vista ejecutiva para operación diaria: ocupación + limpieza + ingresos + alertas.
        </CardContent>
      </Card>

      {k ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard title="Ocupación" value={`${k.occupancyPct}%`} subtitle={`${k.occupied}/${k.totalRooms} ocupadas`} />
          <KpiCard title="Disponibles" value={`${k.available}`} subtitle="Listas para asignar" />
          <KpiCard title="Dirty" value={`${k.dirty}`} subtitle="Requieren limpieza" />
          <KpiCard title="Cleaning" value={`${k.cleaning}`} subtitle="En proceso" />
          <KpiCard title="Out of service" value={`${k.outOfService}`} subtitle="Mantenimiento/No usable" />
          <KpiCard title="Ingresos hoy" value={mxn(k.dayRevenueCents)} subtitle="Reservas + cargos" />
          <KpiCard title="Ingresos semana" value={mxn(k.weekRevenueCents)} subtitle="Lun→hoy" />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => router.push(`/app/hotel/calendar?businessId=${bid}`)}>
                Calendario por habitación
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.push(`/app/hotel/frontdesk?businessId=${bid}`)}>
                Front Desk
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.push(`/app/hotel/reservations?businessId=${bid}`)}>
                Reservas
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data.alerts?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map((a, idx) => (
              <Alert key={idx}>
                <AlertTitle>{a.type}</AlertTitle>
                <AlertDescription>{a.text}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <SimpleList title="Llegadas hoy" items={data.arrivalsToday} />
        <SimpleList title="Salidas hoy" items={data.departuresToday} />
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function SimpleList({ title, items }: { title: string; items: any[] }) {
  function sumCharges(charges: Array<{ amountCents: number }> | undefined) {
    return (charges ?? []).reduce((s, c) => s + (c.amountCents ?? 0), 0);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary">{items?.length ?? 0}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items?.length ? (
          items.slice(0, 12).map((r) => {
            const chargesCents = sumCharges(r.charges);
            return (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="font-medium">{r.guest?.fullName ?? "Huésped"}</div>
                <div className="text-xs text-muted-foreground">
                  {r.room?.name ?? "Habitación"} · {new Date(r.checkIn).toLocaleDateString()} →{" "}
                  {new Date(r.checkOut).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Estatus: <b>{r.status}</b> · Cargos: <b>{mxn(chargesCents)}</b>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground">Sin registros.</div>
        )}
      </CardContent>
    </Card>
  );
}
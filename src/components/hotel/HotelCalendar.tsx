"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Data = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  from: string | null;
  to: string | null;
  rooms: Array<{ id: string; name: string; status: string; roomType: { name: string } }>;
  reservations: Array<{ id: string; status: string; checkIn: string; checkOut: string; roomId: string; guest: { fullName: string } }>;
};

function ymdToDate(s: string) {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + 86400000 * days);
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function HotelCalendar({ data, me }: { data: Data; me: { role: string; allowedToSwitch: boolean } }) {
  const router = useRouter();
  const businesses = data.businesses ?? [];
  const bid = data.businessId ?? "";
  const [from, setFrom] = React.useState(data.from ?? "");
  const [to, setTo] = React.useState(data.to ?? "");

  const fromD = from ? ymdToDate(from) : new Date();
  const toD = to ? ymdToDate(to) : addDays(fromD, 30);
  const totalDays = Math.max(1, daysBetween(fromD, toD));

  const days = Array.from({ length: totalDays }).map((_, i) => addDays(fromD, i));

  function onBusinessChange(id: string) {
    router.push(`/app/hotel/calendar?businessId=${id}&from=${from}&to=${to}`);
  }
  function apply() {
    router.push(`/app/hotel/calendar?businessId=${bid}&from=${from}&to=${to}`);
  }

  // index reservations by room
  const byRoom = React.useMemo(() => {
    const map = new Map<string, typeof data.reservations>();
    for (const r of data.reservations ?? []) {
      const arr = map.get(r.roomId) ?? [];
      arr.push(r);
      map.set(r.roomId, arr);
    }
    return map;
  }, [data.reservations]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rango</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[320px_1fr_1fr_auto] items-end">
          {me.allowedToSwitch ? (
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select value={bid} onValueChange={onBusinessChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona negocio" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Unidad fija</div>
          )}

          <div className="space-y-2">
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <Button onClick={apply}>Aplicar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Calendario</CardTitle>
            <Badge variant="secondary">{data.rooms?.length ?? 0} habitaciones</Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto border rounded-lg">
            {/* header */}
            <div className="grid" style={{ gridTemplateColumns: `260px repeat(${totalDays}, 36px)` }}>
              <div className="sticky left-0 z-10 bg-background border-b p-2 text-xs font-medium">
                Habitación
              </div>
              {days.map((d) => (
                <div key={d.toISOString()} className="border-b p-2 text-[10px] text-muted-foreground text-center">
                  {d.getDate()}
                </div>
              ))}
            </div>

            {/* rows */}
            {data.rooms.map((room) => {
              const list = byRoom.get(room.id) ?? [];
              return (
                <div
                  key={room.id}
                  className="grid border-b"
                  style={{ gridTemplateColumns: `260px repeat(${totalDays}, 36px)` }}
                >
                  <div className="sticky left-0 z-10 bg-background p-2 border-r">
                    <div className="text-sm font-medium">{room.name}</div>
                    <div className="text-xs text-muted-foreground">{room.roomType?.name} · {room.status}</div>
                  </div>

                  {/* background cells */}
                  {days.map((d) => (
                    <div key={d.toISOString()} className="border-r h-[44px]" />
                  ))}

                  {/* bars overlay */}
                  <div
                    className="col-start-2 col-end-[999] relative"
                    style={{ gridColumn: `2 / span ${totalDays}` }}
                  >
                    {list.map((r) => {
                      const ci = new Date(r.checkIn);
                      const co = new Date(r.checkOut);

                      const start = Math.max(0, daysBetween(fromD, ci));
                      const end = Math.min(totalDays, daysBetween(fromD, co));
                      const span = Math.max(1, end - start);

                      const leftPx = start * 36;
                      const widthPx = span * 36;

                      return (
                        <button
                          key={r.id}
                          onClick={() => router.push(`/app/hotel/reservations?businessId=${bid}`)}
                          className="absolute top-[8px] h-[28px] rounded-md border px-2 text-left text-[11px] bg-muted hover:bg-muted/80"
                          style={{ left: leftPx, width: widthPx }}
                          title={`${r.guest.fullName} · ${new Date(r.checkIn).toLocaleDateString()} → ${new Date(r.checkOut).toLocaleDateString()}`}
                        >
                          <span className="font-medium truncate block">{r.guest.fullName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground mt-2">
            Próximo upgrade: click abre detalle de reserva + drag/drop para rebooking (opcional).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
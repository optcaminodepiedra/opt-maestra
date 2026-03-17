"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  markNoShow,
  checkInReservation,
} from "@/lib/hotel.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type Boot = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  rooms: Array<{ id: string; name: string; status: string; roomType: { name: string } }>;
  reservations: Array<{
    id: string;
    status: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    totalCents: number;
    depositCents: number;
    note: string | null;
    room: { id: string; name: string; roomType: { name: string } };
    guest: { id: string; fullName: string; phone: string | null; email: string | null };
  }>;
};

type Me = { userId: string; role: string };

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELED", "NO_SHOW"] as const;

function centsToMxn(cents: number) {
  return (cents / 100).toFixed(2);
}

function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseDateInput(s: string) {
  // s: yyyy-mm-dd
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function ReservationsManager({ boot, me }: { boot: Boot; me: Me }) {
  const router = useRouter();
  const businesses = boot.businesses ?? [];
  const rooms = boot.rooms ?? [];
  const reservations = boot.reservations ?? [];

  const [businessId, setBusinessId] = React.useState(boot.businessId ?? "");
  const [from, setFrom] = React.useState(yyyyMmDd(new Date()));
  const [to, setTo] = React.useState(yyyyMmDd(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)));

  const [status, setStatus] = React.useState<string>("ALL");
  const [guestQ, setGuestQ] = React.useState("");
  const [view, setView] = React.useState<"LIST" | "WEEK">("LIST");

  function applyFilters() {
    router.push(`/app/hotel/reservations?businessId=${businessId}&from=${from}&to=${to}`);
  }

  function onBusinessChange(id: string) {
    setBusinessId(id);
    router.push(`/app/hotel/reservations?businessId=${id}&from=${from}&to=${to}`);
  }

  const filtered = reservations
    .filter((r) => (status === "ALL" ? true : r.status === status))
    .filter((r) => {
      const q = guestQ.trim().toLowerCase();
      if (!q) return true;
      const s = `${r.guest.fullName} ${r.guest.phone ?? ""} ${r.guest.email ?? ""} ${r.room.name}`.toLowerCase();
      return s.includes(q);
    });

  // calendar week = desde "from"
  const weekStart = parseDateInput(from);
  const weekDays = Array.from({ length: 7 }).map((_, i) => new Date(weekStart.getTime() + i * 86400000));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filtros</CardTitle>
            <div className="flex gap-2">
              <Button variant={view === "LIST" ? "default" : "outline"} onClick={() => setView("LIST")}>
                Lista
              </Button>
              <Button variant={view === "WEEK" ? "default" : "outline"} onClick={() => setView("WEEK")}>
                Semana
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select value={businessId} onValueChange={onBusinessChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona negocio" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Estatus</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input
              placeholder="Buscar huésped/teléfono/email/habitación"
              value={guestQ}
              onChange={(e) => setGuestQ(e.target.value)}
            />
            <Button variant="outline" onClick={applyFilters}>Aplicar</Button>

            <NewReservationDialog
              businessId={businessId}
              rooms={rooms}
              userId={me.userId}
              onCreated={() => router.refresh()}
            />
          </div>
        </CardContent>
      </Card>

      {view === "LIST" ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Reservas</CardTitle>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{r.guest.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.room.name} · {r.room.roomType.name} · {new Date(r.checkIn).toLocaleDateString()} →{" "}
                      {new Date(r.checkOut).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Estatus: <span className="font-medium">{r.status}</span> · Total ${centsToMxn(r.totalCents)} · Depósito ${centsToMxn(r.depositCents)}
                    </div>
                    {r.note ? <div className="text-xs text-muted-foreground">Nota: {r.note}</div> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <EditReservationDialog r={r as any} rooms={rooms as any} onSaved={() => router.refresh()} />

                    {r.status === "CONFIRMED" || r.status === "PENDING" ? (
                      <Button
                        onClick={async () => {
                          await checkInReservation({ reservationId: r.id });
                          router.refresh();
                        }}
                      >
                        Check-in
                      </Button>
                    ) : null}

                    {(r.status === "CONFIRMED" || r.status === "PENDING") ? (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm("¿Marcar como NO-SHOW?")) return;
                          await markNoShow({ reservationId: r.id });
                          router.refresh();
                        }}
                      >
                        No-show
                      </Button>
                    ) : null}

                    {r.status !== "CANCELED" && r.status !== "CHECKED_OUT" ? (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm("¿Cancelar reserva?")) return;
                          await cancelReservation({ reservationId: r.id, reason: "Cancelada desde PMS" });
                          router.refresh();
                        }}
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay reservas con esos filtros.</div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calendario semanal (desde {from})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((d) => (
                <div key={d.toISOString()} className="rounded-lg border p-2">
                  <div className="text-xs font-medium">{d.toLocaleDateString()}</div>
                  <div className="mt-2 space-y-2">
                    {filtered
                      .filter((r) => {
                        const ci = new Date(r.checkIn);
                        const co = new Date(r.checkOut);
                        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
                        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
                        return ci < dayEnd && co > dayStart;
                      })
                      .slice(0, 5)
                      .map((r) => (
                        <div key={r.id} className="rounded-md border px-2 py-1 text-xs">
                          <div className="font-medium">{r.room.name}</div>
                          <div className="text-muted-foreground">{r.guest.fullName}</div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              Siguiente upgrade: barras por habitación + drag/drop.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NewReservationDialog({
  businessId,
  rooms,
  userId,
  onCreated,
}: {
  businessId: string;
  rooms: Array<{ id: string; name: string; roomType: { name: string } }>;
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [roomId, setRoomId] = React.useState(rooms[0]?.id ?? "");
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [checkIn, setCheckIn] = React.useState(yyyyMmDd(new Date()));
  const [checkOut, setCheckOut] = React.useState(yyyyMmDd(new Date(Date.now() + 86400000)));
  const [adults, setAdults] = React.useState("2");
  const [children, setChildren] = React.useState("0");
  const [total, setTotal] = React.useState("1500");
  const [deposit, setDeposit] = React.useState("0");
  const [note, setNote] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nueva reserva</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nueva reserva</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Habitación</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {r.roomType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Adultos</Label>
              <Input value={adults} onChange={(e) => setAdults(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Niños</Label>
              <Input value={children} onChange={(e) => setChildren(e.target.value)} inputMode="numeric" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Huésped</Label>
            <Input placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Total (MXN)</Label>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Depósito (MXN)</Label>
              <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
          </div>

          <Button
            className="w-full"
            disabled={!businessId || !roomId || !fullName.trim()}
            onClick={async () => {
              await createReservation({
                businessId,
                roomId,
                userId,
                guestFullName: fullName,
                guestPhone: phone || undefined,
                guestEmail: email || undefined,
                checkIn: new Date(checkIn + "T12:00:00").toISOString(),
                checkOut: new Date(checkOut + "T12:00:00").toISOString(),
                adults: parseInt(adults || "1", 10),
                children: parseInt(children || "0", 10),
                total: parseFloat(total || "0"),
                deposit: parseFloat(deposit || "0"),
                note,
              });

              setOpen(false);
              setFullName("");
              setPhone("");
              setEmail("");
              setNote("");
              onCreated();
            }}
          >
            Crear reserva
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditReservationDialog({ r, rooms, onSaved }: { r: any; rooms: any[]; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [roomId, setRoomId] = React.useState(r.room.id);
  const [checkIn, setCheckIn] = React.useState(yyyyMmDd(new Date(r.checkIn)));
  const [checkOut, setCheckOut] = React.useState(yyyyMmDd(new Date(r.checkOut)));
  const [adults, setAdults] = React.useState(String(r.adults));
  const [children, setChildren] = React.useState(String(r.children));
  const [total, setTotal] = React.useState(String(r.totalCents / 100));
  const [deposit, setDeposit] = React.useState(String(r.depositCents / 100));
  const [note, setNote] = React.useState(r.note ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Editar reserva</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Habitación</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map((rm) => (
                  <SelectItem key={rm.id} value={rm.id}>
                    {rm.name} · {rm.roomType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Check-out</Label>
              <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input value={adults} onChange={(e) => setAdults(e.target.value)} inputMode="numeric" placeholder="Adultos" />
            <Input value={children} onChange={(e) => setChildren(e.target.value)} inputMode="numeric" placeholder="Niños" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="Total" />
            <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="Depósito" />
          </div>

          <div className="space-y-2">
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button
            className="w-full"
            onClick={async () => {
              await updateReservation({
                id: r.id,
                roomId,
                checkIn: new Date(checkIn + "T12:00:00").toISOString(),
                checkOut: new Date(checkOut + "T12:00:00").toISOString(),
                adults: parseInt(adults || "1", 10),
                children: parseInt(children || "0", 10),
                total: parseFloat(total || "0"),
                deposit: parseFloat(deposit || "0"),
                note,
              });
              setOpen(false);
              onSaved();
            }}
          >
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
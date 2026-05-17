"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, AlertCircle } from "lucide-react";

import { STATUS_STYLES, type Room, type Reservation } from "./HotelReservationGrid";
import {
  parseReservationDate, nightsBetween, toDateInputValue, fromDateInputValue,
} from "@/lib/hotel-calendar-utils";
import {
  updateReservation, cancelReservation, markNoShow, checkInReservation,
  checkOutReservation, transferReservation, extendReservation, addChargeToReservation,
} from "@/lib/hotel.actions";

export function ReservationDetailDialog({
  reservation, rooms, onClose, onSaved,
}: {
  reservation: Reservation;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = React.useState<"detail" | "edit" | "transfer" | "extend" | "charge">("detail");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ci = parseReservationDate(reservation.checkIn);
  const co = parseReservationDate(reservation.checkOut);
  const nights = nightsBetween(ci, co);
  const status = STATUS_STYLES[reservation.status] ?? STATUS_STYLES.CONFIRMED;
  const chargesTotal = (reservation.charges ?? []).reduce((s, c) => s + c.amountCents, 0);

  async function handleAction(fn: () => Promise<any>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{reservation.guest.fullName}</span>
            <Badge className={`${status.bar} border`}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Info */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Check-in</p>
              <p className="font-medium">{ci.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Check-out</p>
              <p className="font-medium">{co.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Habitación</p>
              <p className="font-medium">{reservation.room.name} · {reservation.room.roomType.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estadía</p>
              <p className="font-medium">{nights} noche{nights !== 1 ? "s" : ""} · {reservation.adults} adulto{reservation.adults !== 1 ? "s" : ""}{reservation.children > 0 && ` · ${reservation.children} niño${reservation.children !== 1 ? "s" : ""}`}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-base">${(reservation.totalCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Depósito · Cargos extra</p>
              <p className="font-medium">
                ${(reservation.depositCents / 100).toLocaleString("es-MX")}
                {chargesTotal > 0 && (
                  <> · <span className="text-emerald-700">+${(chargesTotal / 100).toLocaleString("es-MX")}</span></>
                )}
              </p>
            </div>
          </div>

          {(reservation.guest.phone || reservation.guest.email) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {reservation.guest.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {reservation.guest.phone}</span>
                )}
                {reservation.guest.email && (
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {reservation.guest.email}</span>
                )}
              </div>
            </>
          )}

          {reservation.notes && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <p className="bg-muted/50 p-2 rounded text-xs">{reservation.notes}</p>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {[
            ["detail", "Acciones"],
            ["edit", "Editar"],
            ["transfer", "Transferir"],
            ["extend", "Extender"],
            ["charge", "Cargo"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === key ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "detail" && <DetailActions reservation={reservation} busy={busy} onAction={handleAction} />}
        {tab === "edit" && <EditPanel reservation={reservation} rooms={rooms} busy={busy} onSubmit={handleAction} />}
        {tab === "transfer" && <TransferPanel reservation={reservation} rooms={rooms.filter((r) => r.id !== reservation.roomId)} busy={busy} onSubmit={handleAction} />}
        {tab === "extend" && <ExtendPanel reservation={reservation} busy={busy} onSubmit={handleAction} />}
        {tab === "charge" && <ChargePanel reservation={reservation} charges={reservation.charges ?? []} busy={busy} onSubmit={handleAction} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailActions({ reservation, busy, onAction }: any) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(reservation.status === "CONFIRMED" || reservation.status === "PENDING") && (
        <Button
          onClick={() => onAction(() => checkInReservation({ reservationId: reservation.id }))}
          disabled={busy}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          Check-in
        </Button>
      )}
      {reservation.status === "CHECKED_IN" && (
        <Button
          onClick={() => onAction(() => checkOutReservation({ reservationId: reservation.id }))}
          disabled={busy}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Check-out
        </Button>
      )}
      {(reservation.status === "CONFIRMED" || reservation.status === "PENDING") && (
        <Button
          variant="outline"
          onClick={() => {
            if (!confirm("¿Marcar como no-show?")) return;
            onAction(() => markNoShow({ reservationId: reservation.id }));
          }}
          disabled={busy}
        >
          Marcar No-Show
        </Button>
      )}
      {reservation.status !== "CANCELED" && reservation.status !== "CHECKED_OUT" && (
        <Button
          variant="outline"
          onClick={() => {
            if (!confirm("¿Cancelar reserva?")) return;
            onAction(() => cancelReservation({ reservationId: reservation.id }));
          }}
          disabled={busy}
          className="text-red-600 hover:text-red-700"
        >
          Cancelar reserva
        </Button>
      )}
    </div>
  );
}

function EditPanel({ reservation, rooms, busy, onSubmit }: any) {
  const [roomId, setRoomId] = React.useState(reservation.roomId);
  const [ci, setCi] = React.useState(toDateInputValue(parseReservationDate(reservation.checkIn)));
  const [co, setCo] = React.useState(toDateInputValue(parseReservationDate(reservation.checkOut)));
  const [adults, setAdults] = React.useState(String(reservation.adults));
  const [children, setChildren] = React.useState(String(reservation.children));
  const [total, setTotal] = React.useState(String(reservation.totalCents / 100));
  const [deposit, setDeposit] = React.useState(String(reservation.depositCents / 100));
  const [note, setNote] = React.useState(reservation.notes ?? "");

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Habitación</Label>
        <Select value={roomId} onValueChange={setRoomId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {rooms.map((r: Room) => (
              <SelectItem key={r.id} value={r.id}>{r.name} · {r.roomType.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Check-in</Label><Input type="date" value={ci} onChange={(e) => setCi(e.target.value)} /></div>
        <div className="space-y-1"><Label>Check-out</Label><Input type="date" value={co} onChange={(e) => setCo(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Adultos</Label><Input value={adults} onChange={(e) => setAdults(e.target.value)} inputMode="numeric" /></div>
        <div className="space-y-1"><Label>Niños</Label><Input value={children} onChange={(e) => setChildren(e.target.value)} inputMode="numeric" /></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Total (MXN)</Label><Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" /></div>
        <div className="space-y-1"><Label>Depósito (MXN)</Label><Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" /></div>
      </div>

      <div className="space-y-1"><Label>Nota</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>

      <Button
        className="w-full"
        disabled={busy}
        onClick={() => onSubmit(() => updateReservation({
          id: reservation.id, roomId,
          checkIn: fromDateInputValue(ci).toISOString(),
          checkOut: fromDateInputValue(co).toISOString(),
          adults: parseInt(adults, 10),
          children: parseInt(children, 10),
          total: parseFloat(total),
          deposit: parseFloat(deposit),
          note,
        }))}
      >
        Guardar cambios
      </Button>
    </div>
  );
}

function TransferPanel({ reservation, rooms, busy, onSubmit }: any) {
  const [newRoomId, setNewRoomId] = React.useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Transferir <strong>{reservation.guest.fullName}</strong> a otra habitación,
        manteniendo las mismas fechas y cargos.
      </p>

      <div className="space-y-2">
        <Label>Nueva habitación</Label>
        <Select value={newRoomId} onValueChange={setNewRoomId}>
          <SelectTrigger><SelectValue placeholder="Selecciona habitación" /></SelectTrigger>
          <SelectContent>
            {rooms.map((r: Room) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name} · {r.roomType.name} · {r.roomType.capacity}p
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full"
        disabled={busy || !newRoomId}
        onClick={() => onSubmit(() => transferReservation({
          reservationId: reservation.id, newRoomId,
        }))}
      >
        Transferir habitación
      </Button>
    </div>
  );
}

function ExtendPanel({ reservation, busy, onSubmit }: any) {
  const [nights, setNights] = React.useState("1");
  const [price, setPrice] = React.useState("0");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Extender la estadía agregando noches al check-out.
        Opcionalmente puedes agregar el cargo correspondiente al folio.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Noches a agregar</Label>
          <Input value={nights} onChange={(e) => setNights(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label>Precio por noche (opcional)</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0 = sin cargo" />
        </div>
      </div>

      <Button
        className="w-full"
        disabled={busy || !nights || parseInt(nights) <= 0}
        onClick={() => onSubmit(() => extendReservation({
          reservationId: reservation.id,
          additionalNights: parseInt(nights, 10),
          pricePerNight: parseFloat(price) > 0 ? parseFloat(price) : undefined,
        }))}
      >
        Extender {nights} noche{nights !== "1" ? "s" : ""}
      </Button>
    </div>
  );
}

function ChargePanel({ reservation, charges, busy, onSubmit }: any) {
  const [concept, setConcept] = React.useState("");
  const [amount, setAmount] = React.useState("");

  return (
    <div className="space-y-3">
      {charges.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cargos previos</Label>
          <div className="max-h-32 overflow-y-auto border rounded">
            {charges.map((c: any) => (
              <div key={c.id} className="px-2 py-1.5 text-xs flex justify-between border-b last:border-b-0">
                <span>{c.concept}</span>
                <span className="font-medium">${(c.amountCents / 100).toLocaleString("es-MX")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <Label>Concepto del nuevo cargo</Label>
        <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Bar, Room service, Daños..." />
      </div>

      <div className="space-y-2">
        <Label>Monto (MXN)</Label>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </div>

      <Button
        className="w-full"
        disabled={busy || !concept.trim() || parseFloat(amount || "0") <= 0}
        onClick={() => onSubmit(() => addChargeToReservation({
          reservationId: reservation.id,
          concept, amount: parseFloat(amount),
        }))}
      >
        Agregar cargo
      </Button>
    </div>
  );
}

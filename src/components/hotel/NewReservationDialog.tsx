"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";

import type { Room } from "./HotelReservationGrid";
import {
  toDateInputValue, fromDateInputValue, addDays, nightsBetween,
} from "@/lib/hotel-calendar-utils";
import { createReservation } from "@/lib/hotel.actions";

export function NewReservationDialog({
  businessId, userId, rooms, preselectedRoomId, preselectedDate, defaultWalkIn, onClose, onSaved,
}: {
  businessId: string;
  userId: string;
  rooms: Room[];
  preselectedRoomId: string;
  preselectedDate: Date;
  defaultWalkIn?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [roomId, setRoomId] = React.useState(preselectedRoomId);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");

  const [ci, setCi] = React.useState(toDateInputValue(preselectedDate));
  const [co, setCo] = React.useState(toDateInputValue(addDays(preselectedDate, 1)));

  const [adults, setAdults] = React.useState("2");
  const [children, setChildren] = React.useState("0");
  const [total, setTotal] = React.useState("");
  const [deposit, setDeposit] = React.useState("0");
  const [note, setNote] = React.useState("");
  const [walkIn, setWalkIn] = React.useState(defaultWalkIn ?? false);

  // Auto-calcular total cuando cambian habitación/fechas
  React.useEffect(() => {
    const room = rooms.find((r) => r.id === roomId);
    if (room && ci && co) {
      const nights = nightsBetween(fromDateInputValue(ci), fromDateInputValue(co));
      const suggested = (room.roomType.basePriceCents / 100) * Math.max(1, nights);
      setTotal(String(suggested.toFixed(2)));
    }
  }, [roomId, ci, co, rooms]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createReservation({
        businessId, roomId, userId,
        guestFullName: fullName,
        guestPhone: phone || undefined,
        guestEmail: email || undefined,
        checkIn: fromDateInputValue(ci).toISOString(),
        checkOut: fromDateInputValue(co).toISOString(),
        adults: parseInt(adults, 10),
        children: parseInt(children, 10),
        total: parseFloat(total),
        deposit: parseFloat(deposit),
        note, walkIn,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message ?? "Error creando reserva");
    } finally {
      setBusy(false);
    }
  }

  const nights = ci && co ? nightsBetween(fromDateInputValue(ci), fromDateInputValue(co)) : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {walkIn ? "Walk-in (huésped llegó sin reserva)" : "Nueva reserva"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <input
              type="checkbox"
              id="walkIn"
              checked={walkIn}
              onChange={(e) => setWalkIn(e.target.checked)}
            />
            <label htmlFor="walkIn" className="cursor-pointer">
              <strong>Walk-in</strong> — Hacer check-in inmediato al crear
            </label>
          </div>

          <div className="space-y-2">
            <Label>Habitación</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {r.roomType.name} · {r.roomType.capacity}p · ${(r.roomType.basePriceCents / 100).toLocaleString("es-MX")}/n
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Check-in</Label><Input type="date" value={ci} onChange={(e) => setCi(e.target.value)} /></div>
            <div className="space-y-1"><Label>Check-out</Label><Input type="date" value={co} onChange={(e) => setCo(e.target.value)} /></div>
          </div>

          {nights > 0 && (
            <p className="text-xs text-muted-foreground text-center bg-muted/30 py-1 rounded">
              {nights} noche{nights !== 1 ? "s" : ""}
            </p>
          )}

          <Separator />

          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre del huésped" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Adultos</Label><Input value={adults} onChange={(e) => setAdults(e.target.value)} inputMode="numeric" /></div>
            <div className="space-y-1"><Label>Niños</Label><Input value={children} onChange={(e) => setChildren(e.target.value)} inputMode="numeric" /></div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Total (MXN)</Label><Input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" /></div>
            <div className="space-y-1"><Label>Depósito (MXN)</Label><Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" /></div>
          </div>

          <div className="space-y-1"><Label>Nota (opcional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            className="w-full"
            disabled={busy || !fullName.trim() || !roomId || parseFloat(total || "0") <= 0}
            onClick={handleCreate}
          >
            {walkIn ? "Walk-in y check-in" : "Crear reserva"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

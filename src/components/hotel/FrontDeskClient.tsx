"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, LogIn, LogOut, ArrowRightLeft, CalendarPlus, DollarSign,
  Phone, Mail, AlertCircle, BedDouble, Clock,
} from "lucide-react";

import {
  checkInReservation, checkOutReservation, addChargeToReservation,
} from "@/lib/hotel.actions";
import { NewReservationDialog } from "./NewReservationDialog";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import type { Room, Reservation } from "./HotelReservationGrid";

type Props = {
  businessId: string;
  businesses: Array<{ id: string; name: string }>;
  userId: string;
  rooms: Room[];
  arrivals: Reservation[];
  departures: Reservation[];
  inHouse: Reservation[];
  allowedToSwitch: boolean;
};

export function FrontDeskClient({
  businessId, businesses, userId, rooms, arrivals, departures, inHouse, allowedToSwitch,
}: Props) {
  const router = useRouter();

  const [searchQ, setSearchQ] = React.useState("");
  const [selected, setSelected] = React.useState<Reservation | null>(null);
  const [showNew, setShowNew] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function onBusinessChange(id: string) {
    router.push(`/app/hotel/frontdesk?businessId=${id}`);
  }

  function matchSearch(r: Reservation): boolean {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (
      r.guest.fullName.toLowerCase().includes(q) ||
      r.guest.phone?.toLowerCase().includes(q) ||
      r.guest.email?.toLowerCase().includes(q) ||
      r.room.name.toLowerCase().includes(q)
    );
  }

  const fArrivals = arrivals.filter(matchSearch);
  const fDepartures = departures.filter(matchSearch);
  const fInHouse = inHouse.filter(matchSearch);

  async function handleCheckIn(r: Reservation) {
    setBusy(r.id); setError(null);
    try {
      await checkInReservation({ reservationId: r.id });
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  async function handleCheckOut(r: Reservation) {
    if (!confirm(`¿Hacer check-out de ${r.guest.fullName}?`)) return;
    setBusy(r.id); setError(null);
    try {
      await checkOutReservation({ reservationId: r.id });
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setBusy(null);
    }
  }

  // Stats rápidos
  const availableRooms = rooms.filter((r) => r.status === "AVAILABLE").length;
  const dirtyRooms = rooms.filter((r) => r.status === "DIRTY" || r.status === "CLEANING").length;
  const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED").length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {allowedToSwitch && businesses.length > 1 && (
                <Select value={businessId} onValueChange={onBusinessChange}>
                  <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar huésped..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="pl-7 w-[220px] h-9"
                />
              </div>
            </div>

            <Button onClick={() => setShowNew(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" /> Walk-in / Nueva
            </Button>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {availableRooms} disponibles
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {occupiedRooms} ocupadas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {dirtyRooms} para limpiar
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Llegadas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="w-4 h-4 text-emerald-600" />
              Llegadas hoy <Badge variant="outline">{fArrivals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fArrivals.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin llegadas pendientes</p>
            )}
            {fArrivals.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onSelect={() => setSelected(r)}
                primaryAction={
                  <Button
                    size="sm"
                    onClick={() => handleCheckIn(r)}
                    disabled={busy === r.id}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Check-in
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* In House */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="w-4 h-4 text-blue-600" />
              Hospedados <Badge variant="outline">{fInHouse.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fInHouse.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin huéspedes hospedados</p>
            )}
            {fInHouse.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onSelect={() => setSelected(r)}
                actions={
                  <>
                    <Button size="sm" variant="outline" onClick={() => setSelected(r)} className="text-xs">
                      <DollarSign className="w-3 h-3 mr-1" /> Cargo
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(r)} className="text-xs">
                      <ArrowRightLeft className="w-3 h-3 mr-1" /> Trans.
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected(r)} className="text-xs">
                      <CalendarPlus className="w-3 h-3 mr-1" /> Ext.
                    </Button>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* Salidas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="w-4 h-4 text-amber-600" />
              Salidas hoy <Badge variant="outline">{fDepartures.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fDepartures.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin salidas pendientes</p>
            )}
            {fDepartures.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onSelect={() => setSelected(r)}
                primaryAction={
                  <Button
                    size="sm"
                    onClick={() => handleCheckOut(r)}
                    disabled={busy === r.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Check-out
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <ReservationDetailDialog
          reservation={selected}
          rooms={rooms}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); router.refresh(); }}
        />
      )}

      {showNew && (
        <NewReservationDialog
          businessId={businessId}
          userId={userId}
          rooms={rooms}
          preselectedRoomId={rooms[0]?.id ?? ""}
          preselectedDate={new Date()}
          defaultWalkIn
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ReservationCard({
  reservation, onSelect, primaryAction, actions,
}: {
  reservation: Reservation;
  onSelect: () => void;
  primaryAction?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const ci = new Date(reservation.checkIn);
  const co = new Date(reservation.checkOut);
  const nights = Math.round((co.getTime() - ci.getTime()) / 86400000);
  const chargesTotal = (reservation.charges ?? []).reduce((s, c) => s + c.amountCents, 0);

  return (
    <div
      className="border rounded p-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm truncate flex-1">{reservation.guest.fullName}</p>
        <Badge variant="outline" className="text-[10px] shrink-0">{reservation.room.name}</Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{reservation.room.roomType.name} · {nights}n · {reservation.adults}p{reservation.children > 0 && `+${reservation.children}n`}</p>
        <p className="flex items-center gap-2">
          <span><Clock className="w-3 h-3 inline mr-1" />{ci.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} → {co.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
        </p>
        {reservation.guest.phone && (
          <p><Phone className="w-3 h-3 inline mr-1" />{reservation.guest.phone}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-xs">
          <span className="font-semibold">${(reservation.totalCents / 100).toLocaleString("es-MX")}</span>
          {chargesTotal > 0 && <span className="text-emerald-700"> +${(chargesTotal / 100).toLocaleString("es-MX")}</span>}
        </p>
        <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
          {primaryAction}
        </div>
      </div>
      {actions && (
        <div className="flex gap-1 mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

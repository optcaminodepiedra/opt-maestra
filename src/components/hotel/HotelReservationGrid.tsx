"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Filter, Plus,
} from "lucide-react";

import {
  addDays, addMonths, daysBetween, formatMonthYear, formatWeekdayShort,
  getMonthViewRange, isToday, isWeekend, parseReservationDate,
  calculateBarPosition, nightsBetween,
} from "@/lib/hotel-calendar-utils";

import { ReservationDetailDialog } from "./ReservationDetailDialog";
import { NewReservationDialog } from "./NewReservationDialog";

// ─── Types ────────────────────────────────────────────────

export type Room = {
  id: string;
  name: string;
  floor: string | null;
  status: string;
  roomType: { id: string; name: string; capacity: number; basePriceCents: number };
};

export type Reservation = {
  id: string;
  status: string;
  checkIn: string | Date;
  checkOut: string | Date;
  adults: number;
  children: number;
  totalCents: number;
  depositCents: number;
  notes: string | null;
  roomId: string;
  room: { id: string; name: string; roomType: { name: string } };
  guest: { id: string; fullName: string; phone: string | null; email: string | null };
  charges?: Array<{ id: string; concept: string; amountCents: number }>;
};

type Props = {
  rooms: Room[];
  reservations: Reservation[];
  businessId: string;
  businesses: Array<{ id: string; name: string }>;
  userId: string;
  allowedToSwitch: boolean;
};

// ─── Status styles ────────────────────────────────────────

export const STATUS_STYLES: Record<string, { bar: string; barHover: string; label: string }> = {
  PENDING: {
    bar: "bg-amber-100 border-amber-400 text-amber-900",
    barHover: "hover:bg-amber-200",
    label: "Pendiente",
  },
  CONFIRMED: {
    bar: "bg-blue-100 border-blue-400 text-blue-900",
    barHover: "hover:bg-blue-200",
    label: "Confirmada",
  },
  CHECKED_IN: {
    bar: "bg-emerald-100 border-emerald-500 text-emerald-900",
    barHover: "hover:bg-emerald-200",
    label: "Hospedado",
  },
  CHECKED_OUT: {
    bar: "bg-gray-100 border-gray-300 text-gray-700",
    barHover: "hover:bg-gray-200",
    label: "Finalizada",
  },
  NO_SHOW: {
    bar: "bg-red-50 border-red-300 text-red-900 border-dashed",
    barHover: "hover:bg-red-100",
    label: "No-show",
  },
  CANCELED: {
    bar: "bg-gray-50 border-gray-200 text-gray-500",
    barHover: "hover:bg-gray-100",
    label: "Cancelada",
  },
};

const ROOM_STATUS_DOT: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED: "bg-blue-500",
  DIRTY: "bg-amber-500",
  CLEANING: "bg-amber-400",
  MAINTENANCE: "bg-red-500",
  OUT_OF_SERVICE: "bg-gray-400",
  BLOCKED: "bg-gray-600",
};

// ─── Constantes de dimensiones ────────────────────────────

const DAY_WIDTH = 48;
const ROOM_COL_WIDTH = 220;
const ROW_HEIGHT = 56;

// ─── Componente principal ────────────────────────────────

export function HotelReservationGrid({
  rooms, reservations, businessId, businesses, userId, allowedToSwitch,
}: Props) {
  const router = useRouter();

  const [viewMonth, setViewMonth] = React.useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [searchQ, setSearchQ] = React.useState("");

  const [selectedRes, setSelectedRes] = React.useState<Reservation | null>(null);
  const [newResData, setNewResData] = React.useState<{ roomId: string; date: Date } | null>(null);

  const { from: rangeFrom, to: rangeTo } = getMonthViewRange(viewMonth, 7);
  const totalDays = daysBetween(rangeFrom, rangeTo);
  const days = React.useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < totalDays; i++) arr.push(addDays(rangeFrom, i));
    return arr;
  }, [rangeFrom, totalDays]);

  const filteredReservations = React.useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const matches = (
          r.guest.fullName.toLowerCase().includes(q) ||
          r.guest.phone?.toLowerCase().includes(q) ||
          r.guest.email?.toLowerCase().includes(q) ||
          r.room.name.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, searchQ]);

  const reservationsByRoom = React.useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of filteredReservations) {
      const arr = map.get(r.roomId) ?? [];
      arr.push(r);
      map.set(r.roomId, arr);
    }
    return map;
  }, [filteredReservations]);

  function onBusinessChange(id: string) {
    router.push(`/app/hotel/reservations?businessId=${id}`);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="default" size="sm" onClick={() => setViewMonth(new Date())}>Hoy</Button>
              <Button variant="outline" size="sm" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <div className="text-base font-semibold ml-2 min-w-[180px]">
                {formatMonthYear(viewMonth)}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendientes</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                  <SelectItem value="CHECKED_IN">Hospedados</SelectItem>
                  <SelectItem value="CHECKED_OUT">Finalizadas</SelectItem>
                  <SelectItem value="NO_SHOW">No-show</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Buscar huésped..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-[180px] h-9"
              />

              <Button
                size="sm"
                onClick={() => setNewResData({ roomId: rooms[0]?.id ?? "", date: new Date() })}
                disabled={!rooms.length}
              >
                <Plus className="w-4 h-4 mr-1" /> Nueva
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
            <span className="text-muted-foreground">Estados:</span>
            {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const).map((k) => {
              const v = STATUS_STYLES[k];
              return (
                <span key={k} className="flex items-center gap-1">
                  <span className={`w-3 h-3 rounded border ${v.bar.split(" ").slice(0, 2).join(" ")}`} />
                  <span>{v.label}</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <CardContent className="p-0">
          {rooms.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay habitaciones registradas. Ve a "Habitaciones" para crearlas.
            </div>
          ) : (
            <div className="overflow-auto border rounded-b-lg max-h-[calc(100vh-280px)]">
              {/* Header */}
              <div
                className="grid sticky top-0 z-20 bg-background border-b"
                style={{ gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${totalDays}, ${DAY_WIDTH}px)` }}
              >
                <div className="sticky left-0 z-10 bg-background border-r p-2 text-xs font-semibold">
                  Habitación ({rooms.length})
                </div>
                {days.map((d) => {
                  const today = isToday(d);
                  const weekend = isWeekend(d);
                  return (
                    <div
                      key={d.toISOString()}
                      className={`border-r p-1 text-center ${
                        today ? "bg-blue-50" : weekend ? "bg-muted/30" : ""
                      }`}
                    >
                      <div className={`text-[9px] ${today ? "text-blue-700 font-bold" : "text-muted-foreground"}`}>
                        {formatWeekdayShort(d)}
                      </div>
                      <div className={`text-xs ${today ? "text-blue-700 font-bold" : "font-medium"}`}>
                        {d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Filas */}
              {rooms.map((room) => {
                const list = reservationsByRoom.get(room.id) ?? [];
                return (
                  <div
                    key={room.id}
                    className="grid border-b relative hover:bg-muted/5"
                    style={{
                      gridTemplateColumns: `${ROOM_COL_WIDTH}px repeat(${totalDays}, ${DAY_WIDTH}px)`,
                      minHeight: ROW_HEIGHT,
                    }}
                  >
                    {/* Info habitación */}
                    <div className="sticky left-0 z-10 bg-background border-r p-2 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${ROOM_STATUS_DOT[room.status] ?? "bg-gray-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{room.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {room.roomType.name} · {room.roomType.capacity}p
                          {room.floor && ` · P${room.floor}`}
                        </p>
                      </div>
                    </div>

                    {/* Celdas vacías clickeables */}
                    {days.map((d) => {
                      const today = isToday(d);
                      const weekend = isWeekend(d);
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          className={`border-r ${
                            today ? "bg-blue-50/30" : weekend ? "bg-muted/10" : ""
                          } hover:bg-blue-50 transition-colors`}
                          onClick={() => setNewResData({ roomId: room.id, date: d })}
                          aria-label={`Crear reserva en ${room.name} el ${d.getDate()}`}
                        />
                      );
                    })}

                    {/* Capa overlay con barras */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: ROOM_COL_WIDTH,
                        top: 0,
                        height: ROW_HEIGHT,
                        width: totalDays * DAY_WIDTH,
                      }}
                    >
                      {list.map((r) => {
                        const ci = parseReservationDate(r.checkIn);
                        const co = parseReservationDate(r.checkOut);
                        const pos = calculateBarPosition(ci, co, rangeFrom, totalDays, DAY_WIDTH);
                        if (!pos) return null;

                        const style = STATUS_STYLES[r.status] ?? STATUS_STYLES.CONFIRMED;
                        const nights = nightsBetween(ci, co);

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedRes(r)}
                            className={`absolute top-2 h-10 rounded-md border-2 px-2 text-left text-[11px] overflow-hidden pointer-events-auto transition-all ${style.bar} ${style.barHover} ${
                              pos.clippedStart ? "rounded-l-none border-l-0" : ""
                            } ${pos.clippedEnd ? "rounded-r-none border-r-0" : ""}`}
                            style={{ left: pos.leftPx, width: pos.widthPx }}
                            title={`${r.guest.fullName} · ${ci.toLocaleDateString("es-MX")} → ${co.toLocaleDateString("es-MX")} · ${nights}n`}
                          >
                            <p className="font-semibold truncate leading-tight">{r.guest.fullName}</p>
                            <p className="text-[9px] opacity-75 truncate leading-tight">
                              {nights}n · {r.adults}p · ${(r.totalCents / 100).toLocaleString("es-MX")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRes && (
        <ReservationDetailDialog
          reservation={selectedRes}
          rooms={rooms}
          onClose={() => setSelectedRes(null)}
          onSaved={() => { setSelectedRes(null); router.refresh(); }}
        />
      )}

      {newResData && (
        <NewReservationDialog
          businessId={businessId}
          userId={userId}
          rooms={rooms}
          preselectedRoomId={newResData.roomId}
          preselectedDate={newResData.date}
          onClose={() => setNewResData(null)}
          onSaved={() => { setNewResData(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

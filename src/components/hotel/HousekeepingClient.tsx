"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, AlertCircle, CheckCircle2, Wrench, Bed,
  LogOut, LogIn, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setRoomStatus, setRoomStatusBulk } from "@/lib/hotel.actions";

type RoomType = {
  id: string; name: string;
  basePriceCents: number;
  capacity: number;
  kind: string;
};

type Room = {
  id: string;
  name: string;
  floor: string | null;
  area: string | null;
  status: string;
  roomTypeId: string;
  roomType: RoomType;
};

type Reservation = {
  id: string;
  checkIn: string | Date;
  checkOut: string | Date;
  status: string;
  guest: { fullName: string };
  room: { id: string; name: string; floor: string | null };
};

type Business = { id: string; name: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; text: string; icon: any }> = {
  AVAILABLE:      { label: "Disponible",       color: "#10b981", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", icon: CheckCircle2 },
  OCCUPIED:       { label: "Ocupada",          color: "#3b82f6", bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-700",    icon: Bed },
  DIRTY:          { label: "Sucia",            color: "#f59e0b", bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-700",   icon: AlertCircle },
  CLEANING:       { label: "Limpiando",        color: "#a855f7", bg: "bg-purple-50",  border: "border-purple-300",  text: "text-purple-700",  icon: Sparkles },
  MAINTENANCE:    { label: "Mantenimiento",    color: "#ef4444", bg: "bg-red-50",     border: "border-red-300",     text: "text-red-700",     icon: Wrench },
  OUT_OF_SERVICE: { label: "Fuera de servicio", color: "#64748b", bg: "bg-slate-100", border: "border-slate-300",   text: "text-slate-700",   icon: AlertCircle },
  BLOCKED:        { label: "Bloqueada",        color: "#64748b", bg: "bg-slate-100", border: "border-slate-300",   text: "text-slate-700",   icon: AlertCircle },
};

function isSameDayIso(a: string | Date, b: Date) {
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() && da.getMonth() === b.getMonth() && da.getDate() === b.getDate();
}

export default function HousekeepingClient(props: {
  businesses: Business[];
  businessId: string | null;
  rooms: Room[];
  todayArrivals: Reservation[];
  todayCheckOuts: Reservation[];
}) {
  const { businesses, businessId, rooms, todayArrivals, todayCheckOuts } = props;
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterFloor, setFilterFloor] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState(false);

  const today = new Date();

  // Mapas auxiliares
  const checkOutByRoom = useMemo(() => {
    const m = new Map<string, Reservation>();
    todayCheckOuts.forEach((r) => { if (isSameDayIso(r.checkOut, today)) m.set(r.room.id, r); });
    return m;
  }, [todayCheckOuts]);

  const arrivalByRoom = useMemo(() => {
    const m = new Map<string, Reservation>();
    todayArrivals.forEach((r) => { if (isSameDayIso(r.checkIn, today)) m.set(r.room.id, r); });
    return m;
  }, [todayArrivals]);

  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => { if (r.floor) set.add(r.floor); });
    return Array.from(set).sort();
  }, [rooms]);

  // Habitaciones agrupadas por prioridad
  const priorities = useMemo(() => {
    const filtered = rooms.filter((r) => {
      if (filterFloor !== "ALL" && r.floor !== filterFloor) return false;
      if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.roomType.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Prioridad 1: Salidas hoy + DIRTY
    const checkoutPriority = filtered.filter((r) => checkOutByRoom.has(r.id));
    // Prioridad 2: DIRTY sin salida hoy
    const dirty = filtered.filter((r) => r.status === "DIRTY" && !checkOutByRoom.has(r.id));
    // Prioridad 3: CLEANING
    const cleaning = filtered.filter((r) => r.status === "CLEANING");
    // Prioridad 4: MAINTENANCE / OOS / BLOCKED
    const issues = filtered.filter((r) => ["MAINTENANCE", "OUT_OF_SERVICE", "BLOCKED"].includes(r.status));
    // Resto: AVAILABLE / OCCUPIED
    const ok = filtered.filter((r) => ["AVAILABLE", "OCCUPIED"].includes(r.status) && !checkOutByRoom.has(r.id));

    return { checkoutPriority, dirty, cleaning, issues, ok };
  }, [rooms, filterFloor, filterStatus, search, checkOutByRoom]);

  // Stats
  const stats = useMemo(() => {
    return {
      checkoutsToday: todayCheckOuts.length,
      arrivalsToday: todayArrivals.length,
      dirty: rooms.filter((r) => r.status === "DIRTY").length,
      cleaning: rooms.filter((r) => r.status === "CLEANING").length,
      maintenance: rooms.filter((r) => ["MAINTENANCE", "OUT_OF_SERVICE", "BLOCKED"].includes(r.status)).length,
      ready: rooms.filter((r) => r.status === "AVAILABLE").length,
    };
  }, [rooms, todayCheckOuts, todayArrivals]);

  if (!businessId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">No tienes hoteles asignados.</p>
      </div>
    );
  }

  function changeStatus(roomId: string, newStatus: string) {
    (async () => {
      try {
        await setRoomStatus({ roomId, status: newStatus as any });
      } catch (e: any) {
        alert(e.message || "Error");
      }
      })();
  }

  function bulkChangeStatus(newStatus: string) {
    if (selected.size === 0) return;
    (async () => {
      try {
        await setRoomStatusBulk({ roomIds: Array.from(selected), status: newStatus as any });
        setSelected(new Set());
        setBulkDialog(false);
      } catch (e: any) {
        alert(e.message || "Error");
      }
      })();
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-4">
      {/* Selector de hotel */}
      {businesses.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-3">
          <Label className="text-sm font-medium text-slate-600">Hotel:</Label>
          <Select
            value={businessId ?? undefined}
            onValueChange={(id) => router.push(`/app/hotel/housekeeping?businessId=${id}`)}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Salidas hoy" value={stats.checkoutsToday} icon={LogOut} color="#f59e0b" />
        <StatCard label="Llegadas hoy" value={stats.arrivalsToday} icon={LogIn} color="#3b82f6" />
        <StatCard label="Sucias" value={stats.dirty} icon={AlertCircle} color="#f59e0b" />
        <StatCard label="Limpiando" value={stats.cleaning} icon={Sparkles} color="#a855f7" />
        <StatCard label="Mantenimiento" value={stats.maintenance} icon={Wrench} color="#ef4444" />
        <StatCard label="Listas" value={stats.ready} icon={CheckCircle2} color="#10b981" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar habitación..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {floors.length > 0 && (
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los pisos</SelectItem>
              {floors.map((f) => (<SelectItem key={f} value={f}>Piso {f}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, c]) => (
              <SelectItem key={k} value={k}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <Button onClick={() => setBulkDialog(true)} size="sm">
            <Sparkles className="mr-1 h-4 w-4" />
            Acción en {selected.size}
          </Button>
        )}
      </div>

      {/* Listas priorizadas */}
      <div className="space-y-4">
        {priorities.checkoutPriority.length > 0 && (
          <PrioritySection
            title="🚪 Salidas de hoy"
            description="Limpiar después del check-out para la siguiente llegada"
            color="border-l-amber-500"
            rooms={priorities.checkoutPriority}
            checkOutByRoom={checkOutByRoom}
            arrivalByRoom={arrivalByRoom}
            selected={selected}
            onToggle={toggleSelect}
            onChangeStatus={changeStatus}
          />
        )}

        {priorities.dirty.length > 0 && (
          <PrioritySection
            title="🧺 Sucias"
            description="Habitaciones que necesitan limpieza"
            color="border-l-amber-500"
            rooms={priorities.dirty}
            checkOutByRoom={checkOutByRoom}
            arrivalByRoom={arrivalByRoom}
            selected={selected}
            onToggle={toggleSelect}
            onChangeStatus={changeStatus}
          />
        )}

        {priorities.cleaning.length > 0 && (
          <PrioritySection
            title="✨ En limpieza"
            description="Limpieza en proceso"
            color="border-l-purple-500"
            rooms={priorities.cleaning}
            checkOutByRoom={checkOutByRoom}
            arrivalByRoom={arrivalByRoom}
            selected={selected}
            onToggle={toggleSelect}
            onChangeStatus={changeStatus}
          />
        )}

        {priorities.issues.length > 0 && (
          <PrioritySection
            title="🔧 Mantenimiento / Bloqueadas"
            description="Requieren atención de mantenimiento"
            color="border-l-red-500"
            rooms={priorities.issues}
            checkOutByRoom={checkOutByRoom}
            arrivalByRoom={arrivalByRoom}
            selected={selected}
            onToggle={toggleSelect}
            onChangeStatus={changeStatus}
          />
        )}

        {priorities.ok.length > 0 && (
          <PrioritySection
            title="✅ Otras"
            description="Disponibles u ocupadas"
            color="border-l-slate-300"
            rooms={priorities.ok}
            checkOutByRoom={checkOutByRoom}
            arrivalByRoom={arrivalByRoom}
            selected={selected}
            onToggle={toggleSelect}
            onChangeStatus={changeStatus}
            compact
          />
        )}

        {Object.values(priorities).every((p) => p.length === 0) && (
          <div className="rounded-lg border bg-white p-12 text-center text-slate-500">
            No hay habitaciones que coincidan con los filtros.
          </div>
        )}
      </div>

      {/* Bulk dialog */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado de {selected.size} habitaciones</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => bulkChangeStatus(key)}
                  className="flex items-center gap-2 rounded-lg border-2 p-3 text-left transition hover:border-slate-400"
                >
                  <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                  <span className="text-sm font-medium">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────

function StatCard(props: { label: string; value: number; icon: any; color: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-3">
      <div className="rounded-md p-2" style={{ backgroundColor: `${props.color}1A` }}>
        <Icon className="h-5 w-5" style={{ color: props.color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 truncate">{props.label}</div>
        <div className="text-xl font-semibold leading-none" style={{ color: props.color }}>{props.value}</div>
      </div>
    </div>
  );
}

function PrioritySection(props: {
  title: string;
  description: string;
  color: string;
  rooms: Room[];
  checkOutByRoom: Map<string, Reservation>;
  arrivalByRoom: Map<string, Reservation>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onChangeStatus: (roomId: string, newStatus: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-l-4 bg-white ${props.color}`}>
      <div className="border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{props.title}</h3>
            <p className="text-xs text-slate-500">{props.description}</p>
          </div>
          <Badge variant="outline">{props.rooms.length}</Badge>
        </div>
      </div>
      <div className={props.compact ? "grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4" : "divide-y"}>
        {props.rooms.map((room) => (
          <HousekeepingRoomRow
            key={room.id}
            room={room}
            checkOut={props.checkOutByRoom.get(room.id)}
            arrival={props.arrivalByRoom.get(room.id)}
            selected={props.selected.has(room.id)}
            onToggle={() => props.onToggle(room.id)}
            onChangeStatus={(s) => props.onChangeStatus(room.id, s)}
            compact={props.compact}
          />
        ))}
      </div>
    </div>
  );
}

function HousekeepingRoomRow(props: {
  room: Room;
  checkOut?: Reservation;
  arrival?: Reservation;
  selected: boolean;
  onToggle: () => void;
  onChangeStatus: (s: string) => void;
  compact?: boolean;
}) {
  const { room, checkOut, arrival, selected, onToggle, onChangeStatus, compact } = props;
  const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.AVAILABLE;
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-md border p-2 ${selected ? "ring-2 ring-blue-400" : ""}`}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{room.name}</div>
          <div className="truncate text-xs text-slate-500">{cfg.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 transition ${selected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} />

      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 flex-shrink-0" style={{ color: cfg.color }} />
        <div>
          <div className="font-medium">{room.name}</div>
          <div className="text-xs text-slate-500">
            {room.roomType.name}
            {room.floor && ` · Piso ${room.floor}`}
            {room.area && ` · ${room.area}`}
          </div>
        </div>
      </div>

      <Badge variant="outline" className={`${cfg.text} ${cfg.border}`}>{cfg.label}</Badge>

      {/* Info de salida / llegada */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {checkOut && (
          <div className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
            <LogOut className="h-3 w-3" />
            <span>Sale: {checkOut.guest.fullName}</span>
          </div>
        )}
        {arrival && (
          <div className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-blue-800">
            <LogIn className="h-3 w-3" />
            <span>Llega: {arrival.guest.fullName}</span>
          </div>
        )}
      </div>

      <div className="ml-auto flex gap-1">
        {room.status === "DIRTY" && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus("CLEANING")}>
            <Sparkles className="mr-1 h-3 w-3" /> Iniciar limpieza
          </Button>
        )}
        {room.status === "CLEANING" && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus("AVAILABLE")}>
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Marcar lista
          </Button>
        )}
        {room.status === "DIRTY" && (
          <Button size="sm" variant="ghost" onClick={() => onChangeStatus("AVAILABLE")}>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </Button>
        )}
        {!["MAINTENANCE", "OUT_OF_SERVICE", "BLOCKED"].includes(room.status) && (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onChangeStatus("MAINTENANCE")}>
            <Wrench className="h-4 w-4" />
          </Button>
        )}
        {["MAINTENANCE", "OUT_OF_SERVICE", "BLOCKED"].includes(room.status) && (
          <Button size="sm" variant="outline" onClick={() => onChangeStatus("AVAILABLE")}>
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Reactivar
          </Button>
        )}
      </div>
    </div>
  );
}

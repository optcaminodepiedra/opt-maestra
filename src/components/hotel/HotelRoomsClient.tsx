"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Edit2, Trash2, Grid3x3, List, Search, AlertCircle,
  Wrench, Sparkles, Bed, BedDouble, Tent, Building, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  createRoomType, updateRoomType, deleteRoomType,
  createRoom, updateRoom, setRoomStatus,
} from "@/lib/hotel.actions";

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  basePriceCents: number;
  capacity: number;
  kind: string;
};

type Room = {
  id: string;
  name: string;
  floor: string | null;
  area: string | null;
  sortOrder: number;
  status: string;
  isActive: boolean;
  roomTypeId: string;
  roomType: RoomType;
};

type Business = { id: string; name: string };

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string; textClass: string; borderClass: string; icon: any }
> = {
  AVAILABLE: { label: "Disponible", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-300", icon: Bed },
  OCCUPIED:  { label: "Ocupada",    color: "#3b82f6", bgClass: "bg-blue-50",    textClass: "text-blue-700",    borderClass: "border-blue-300",    icon: BedDouble },
  DIRTY:     { label: "Sucia",      color: "#f59e0b", bgClass: "bg-amber-50",   textClass: "text-amber-700",   borderClass: "border-amber-300",   icon: AlertCircle },
  CLEANING:  { label: "Limpiando",  color: "#a855f7", bgClass: "bg-purple-50",  textClass: "text-purple-700",  borderClass: "border-purple-300",  icon: Sparkles },
  MAINTENANCE:    { label: "Mantenimiento", color: "#ef4444", bgClass: "bg-red-50",  textClass: "text-red-700",  borderClass: "border-red-300",  icon: Wrench },
  OUT_OF_SERVICE: { label: "Fuera de servicio", color: "#64748b", bgClass: "bg-slate-100", textClass: "text-slate-700", borderClass: "border-slate-300", icon: AlertCircle },
  BLOCKED:        { label: "Bloqueada", color: "#64748b", bgClass: "bg-slate-100", textClass: "text-slate-700", borderClass: "border-slate-300", icon: AlertCircle },
};

const KIND_ICONS: Record<string, any> = {
  STANDARD: Bed,
  SUITE: BedDouble,
  GLAMPING: Tent,
  CONTAINER: Building,
};

const KIND_LABELS: Record<string, string> = {
  STANDARD: "Estándar",
  SUITE: "Suite",
  GLAMPING: "Glamping",
  CONTAINER: "Contenedor",
};

function formatMxn(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);
}

export default function HotelRoomsClient(props: {
  businesses: Business[];
  businessId: string | null;
  roomTypes: RoomType[];
  rooms: Room[];
}) {
  const { businesses, businessId, roomTypes, rooms } = props;
  const router = useRouter();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterFloor, setFilterFloor] = useState<string>("ALL");

  // Dialogs
  const [roomTypeDialog, setRoomTypeDialog] = useState<{ open: boolean; editing: RoomType | null }>({ open: false, editing: null });
  const [roomDialog, setRoomDialog] = useState<{ open: boolean; editing: Room | null }>({ open: false, editing: null });
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });

  // Floors únicos para filtro
  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => { if (r.floor) set.add(r.floor); });
    return Array.from(set).sort();
  }, [rooms]);

  // Habitaciones filtradas
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
      if (filterType !== "ALL" && r.roomTypeId !== filterType) return false;
      if (filterFloor !== "ALL" && r.floor !== filterFloor) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.roomType.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rooms, filterStatus, filterType, filterFloor, search]);

  // Stats
  const statsByStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    rooms.forEach((r) => { acc[r.status] = (acc[r.status] || 0) + 1; });
    return acc;
  }, [rooms]);

  if (!businessId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">No tienes hoteles asignados.</p>
      </div>
    );
  }

  function handleQuickStatus(room: Room, newStatus: string) {
    (async () => {
      try {
        await setRoomStatus({ roomId: room.id, status: newStatus as any });
      } catch (e: any) {
        alert(e.message || "Error");
      }
      })();
  }

  return (
    <div className="space-y-4">
      {/* Selector de hotel */}
      {businesses.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border bg-white p-3">
          <Label className="text-sm font-medium text-slate-600">Hotel:</Label>
          <Select
            value={businessId}
            onValueChange={(id) => router.push(`/app/hotel/rooms?businessId=${id}`)}
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

      {/* Header con stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statsByStatus[key] || 0;
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "ALL" : key)}
              className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                filterStatus === key
                  ? `${cfg.bgClass} ${cfg.borderClass} ring-2 ring-offset-1`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              style={filterStatus === key ? { boxShadow: `0 0 0 2px ${cfg.color}33` } : undefined}
            >
              <Icon className="h-4 w-4" style={{ color: cfg.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500 truncate">{cfg.label}</div>
                <div className="text-lg font-semibold leading-none" style={{ color: cfg.color }}>{count}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar habitación..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {roomTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {floors.length > 0 && (
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Piso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los pisos</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f} value={f}>Piso {f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex rounded-md border">
          <Button
            size="sm"
            variant={view === "grid" ? "default" : "ghost"}
            className="rounded-r-none"
            onClick={() => setView("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "default" : "ghost"}
            className="rounded-l-none"
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRoomTypeDialog({ open: true, editing: null })}>
            <Plus className="mr-1 h-4 w-4" /> Tipo
          </Button>
          <Button size="sm" onClick={() => setRoomDialog({ open: true, editing: null })}>
            <Plus className="mr-1 h-4 w-4" /> Habitación
          </Button>
        </div>
      </div>

      {/* Lista de habitaciones */}
      {filteredRooms.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-slate-500">
          {rooms.length === 0
            ? "Aún no hay habitaciones. Crea un tipo y después agrega habitaciones."
            : "No hay habitaciones que coincidan con los filtros."}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredRooms.map((room) => {
            const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.AVAILABLE;
            const KindIcon = KIND_ICONS[room.roomType.kind] || Bed;
            return (
              <div
                key={room.id}
                className={`group relative overflow-hidden rounded-lg border-2 p-3 transition hover:shadow-md ${cfg.bgClass} ${cfg.borderClass}`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <KindIcon className="h-4 w-4 flex-shrink-0" style={{ color: cfg.color }} />
                      <span className="font-semibold truncate">{room.name}</span>
                    </div>
                    <div className={`mt-0.5 text-xs ${cfg.textClass}`}>{room.roomType.name}</div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <Badge variant="outline" className={`${cfg.textClass} ${cfg.borderClass} text-[10px]`}>
                    {cfg.label}
                  </Badge>
                  <span className="text-slate-500">{room.roomType.capacity} pax</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  {room.floor && <span>Piso {room.floor}</span>}
                  <span className="font-medium text-slate-700">{formatMxn(room.roomType.basePriceCents)}</span>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 hidden flex-col items-center justify-center gap-1 bg-white/90 group-hover:flex">
                  <Button size="sm" variant="outline" className="w-32 text-xs" onClick={() => setStatusDialog({ open: true, room })}>
                    <Eye className="mr-1 h-3 w-3" /> Cambiar estado
                  </Button>
                  <Button size="sm" variant="outline" className="w-32 text-xs" onClick={() => setRoomDialog({ open: true, editing: room })}>
                    <Edit2 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-3 py-2">Habitación</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Piso</th>
                <th className="px-3 py-2">Capacidad</th>
                <th className="px-3 py-2">Tarifa</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => {
                const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.AVAILABLE;
                return (
                  <tr key={room.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{room.name}</td>
                    <td className="px-3 py-2 text-slate-600">{room.roomType.name}</td>
                    <td className="px-3 py-2 text-slate-600">{room.floor || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{room.roomType.capacity}</td>
                    <td className="px-3 py-2 text-slate-600">{formatMxn(room.roomType.basePriceCents)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`${cfg.textClass} ${cfg.borderClass}`}>{cfg.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setStatusDialog({ open: true, room })}>
                        Estado
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRoomDialog({ open: true, editing: room })}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Sección: Tipos de habitación ─── */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tipos de habitación</h3>
          <Button size="sm" variant="outline" onClick={() => setRoomTypeDialog({ open: true, editing: null })}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo tipo
          </Button>
        </div>
        {roomTypes.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay tipos. Crea uno para poder agregar habitaciones.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roomTypes.map((t) => {
              const Icon = KIND_ICONS[t.kind] || Bed;
              const count = rooms.filter((r) => r.roomTypeId === t.id).length;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-slate-500" />
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-slate-500">
                        {KIND_LABELS[t.kind] || t.kind} · {t.capacity} pax · {formatMxn(t.basePriceCents)} · {count} hab.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRoomTypeDialog({ open: true, editing: t })}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (count > 0) { alert("No se puede borrar: tiene habitaciones asociadas"); return; }
                        if (!confirm(`¿Borrar el tipo "${t.name}"?`)) return;
                        (async () => {
                          try { await deleteRoomType({ id: t.id }); } catch (e: any) { alert(e.message); }
                        })();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Dialogs ─── */}
      <RoomTypeDialog
        open={roomTypeDialog.open}
        editing={roomTypeDialog.editing}
        businessId={businessId}
        onClose={() => setRoomTypeDialog({ open: false, editing: null })}
      />
      <RoomDialog
        open={roomDialog.open}
        editing={roomDialog.editing}
        businessId={businessId}
        roomTypes={roomTypes}
        onClose={() => setRoomDialog({ open: false, editing: null })}
      />
      <StatusDialog
        open={statusDialog.open}
        room={statusDialog.room}
        onClose={() => setStatusDialog({ open: false, room: null })}
        onChange={handleQuickStatus}
      />
    </div>
  );
}

// ─── Sub-componentes (modales) ───────────────────────────────────

function RoomTypeDialog(props: {
  open: boolean; editing: RoomType | null; businessId: string;
  onClose: () => void;
}) {
  const { open, editing, businessId, onClose } = props;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("0");
  const [capacity, setCapacity] = useState("2");
  const [kind, setKind] = useState<string>("STANDARD");

  // Reset al abrir
  useMemo(() => {
    if (open) {
      setName(editing?.name || "");
      setDescription(editing?.description || "");
      setBasePrice(editing ? String((editing.basePriceCents / 100).toFixed(2)) : "0");
      setCapacity(String(editing?.capacity || 2));
      setKind(editing?.kind || "STANDARD");
    }
  }, [open, editing]);

  function save() {
    (async () => {
      try {
        if (editing) {
          await updateRoomType({
            id: editing.id,
            name, description,
            basePrice: parseFloat(basePrice) || 0,
            capacity: parseInt(capacity) || 1,
            kind: kind as any,
          });
        } else {
          await createRoomType({
            businessId, name, description,
            basePrice: parseFloat(basePrice) || 0,
            capacity: parseInt(capacity) || 1,
            kind: kind as any,
          });
        }
        onClose();
      } catch (e: any) {
        alert(e.message || "Error");
      }
      })();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tipo" : "Nuevo tipo de habitación"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Suite ejecutiva" />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tarifa MXN</Label>
              <Input type="number" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div>
              <Label>Capacidad</Label>
              <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Estándar</SelectItem>
                  <SelectItem value="SUITE">Suite</SelectItem>
                  <SelectItem value="GLAMPING">Glamping</SelectItem>
                  <SelectItem value="CONTAINER">Contenedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoomDialog(props: {
  open: boolean; editing: Room | null; businessId: string; roomTypes: RoomType[];
  onClose: () => void;
}) {
  const { open, editing, businessId, roomTypes, onClose } = props;
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [area, setArea] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [isActive, setIsActive] = useState(true);

  useMemo(() => {
    if (open) {
      setName(editing?.name || "");
      setFloor(editing?.floor || "");
      setArea(editing?.area || "");
      setRoomTypeId(editing?.roomTypeId || roomTypes[0]?.id || "");
      setIsActive(editing?.isActive ?? true);
    }
  }, [open, editing, roomTypes]);

  function save() {
    if (!roomTypeId) { alert("Selecciona un tipo de habitación"); return; }
    (async () => {
      try {
        if (editing) {
          await updateRoom({
            id: editing.id, name, floor, area, roomTypeId, isActive,
          });
        } else {
          await createRoom({
            businessId, roomTypeId, name, floor, area,
          });
        }
        onClose();
      } catch (e: any) {
        alert(e.message || "Error");
      }
      })();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar habitación" : "Nueva habitación"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre / Número</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 101, Suite Río, Cabaña 3" />
          </div>
          <div>
            <Label>Tipo de habitación</Label>
            <Select value={roomTypeId} onValueChange={setRoomTypeId}>
              <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} · {formatMxn(t.basePriceCents)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Piso (opcional)</Label>
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Ej: 1, PB, Mezz" />
            </div>
            <div>
              <Label>Área (opcional)</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ej: Ala norte" />
            </div>
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input
                id="active" type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="active" className="cursor-pointer">Activa</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog(props: {
  open: boolean; room: Room | null;
  onClose: () => void;
  onChange: (room: Room, newStatus: string) => void;
}) {
  const { open, room, onClose, onChange } = props;
  if (!room) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar estado: {room.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const active = room.status === key;
            return (
              <button
                key={key}
                onClick={() => { onChange(room, key); onClose(); }}
                className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition ${
                  active ? `${cfg.bgClass} ${cfg.borderClass}` : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                <span className={`text-sm font-medium ${active ? cfg.textClass : "text-slate-700"}`}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

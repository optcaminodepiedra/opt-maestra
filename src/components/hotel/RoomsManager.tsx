"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createRoomType,
  createRoom,
  setRoomStatus,
  updateRoomType,
  deleteRoomType,
  updateRoom,
} from "@/lib/hotel.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Boot = {
  businesses: { id: string; name: string }[];
  businessId: string | null;
  roomTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    capacity: number;
    kind: string;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    floor: string | null;
    area: string | null;
    status: string;
    isActive: boolean;
    sortOrder: number;
    roomTypeId: string;
    roomType: { id: string; name: string; kind: string; capacity: number; basePriceCents: number };
  }>;
};

const STATUS = [
  { key: "AVAILABLE", label: "Disponible" },
  { key: "OCCUPIED", label: "Ocupada" },
  { key: "CLEANING", label: "Limpieza" },
  { key: "DIRTY", label: "Sucia" },
  { key: "MAINTENANCE", label: "Mantenimiento" },
  { key: "OUT_OF_SERVICE", label: "Fuera de servicio" },
  { key: "BLOCKED", label: "Bloqueada" },
] as const;

const KIND = [
  { key: "STANDARD", label: "Standard" },
  { key: "SUITE", label: "Suite" },
  { key: "GLAMPING", label: "Glamping" },
  { key: "CONTAINER", label: "Contenedor" },
] as const;

function mxn(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function RoomsManager({ boot }: { boot: Boot }) {
  const router = useRouter();

  const businesses = boot.businesses ?? [];
  const roomTypes = boot.roomTypes ?? [];
  const rooms = boot.rooms ?? [];
  const [businessId, setBusinessId] = React.useState(boot.businessId ?? "");

  // filters
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [q, setQ] = React.useState("");

  // create room type
  const [rtName, setRtName] = React.useState("");
  const [rtDesc, setRtDesc] = React.useState("");
  const [rtKind, setRtKind] = React.useState("STANDARD");
  const [rtCap, setRtCap] = React.useState("2");
  const [rtPrice, setRtPrice] = React.useState("1500");

  // create room
  const [rName, setRName] = React.useState("");
  const [rFloor, setRFloor] = React.useState("");
  const [rArea, setRArea] = React.useState("");
  const [rTypeId, setRTypeId] = React.useState(roomTypes[0]?.id ?? "");

  function onBusinessChange(id: string) {
    setBusinessId(id);
    router.push(`/app/hotel/rooms?businessId=${id}`);
  }

  const filteredRooms = rooms
    .filter((r) => (statusFilter === "ALL" ? true : r.status === statusFilter))
    .filter((r) => (typeFilter === "ALL" ? true : r.roomTypeId === typeFilter))
    .filter((r) => {
      const s = `${r.name} ${r.floor ?? ""} ${r.area ?? ""} ${r.roomType?.name ?? ""}`.toLowerCase();
      return s.includes(q.trim().toLowerCase());
    });

  async function onCreateRoomType(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    await createRoomType({
      businessId,
      name: rtName.trim(),
      description: rtDesc.trim() || undefined,
      basePrice: parseFloat(rtPrice || "0"),
      capacity: parseInt(rtCap || "1", 10),
      kind: rtKind as any,
    });

    setRtName("");
    setRtDesc("");
    router.refresh();
  }

  async function onCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !rTypeId) return;

    await createRoom({
      businessId,
      roomTypeId: rTypeId,
      name: rName.trim(),
      floor: rFloor.trim() || undefined,
      area: rArea.trim() || undefined,
      sortOrder: 0,
    });

    setRName("");
    setRFloor("");
    setRArea("");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* LEFT: config + creates */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuración</CardTitle>
            <Badge variant="secondary">PMS</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Negocio</Label>
            <Select value={businessId} onValueChange={onBusinessChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona negocio" />
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

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Crear tipo de habitación</div>
            <form className="space-y-2" onSubmit={onCreateRoomType}>
              <Input placeholder="Nombre (Ej. Suite Vista)" value={rtName} onChange={(e) => setRtName(e.target.value)} />
              <Input placeholder="Descripción (opcional)" value={rtDesc} onChange={(e) => setRtDesc(e.target.value)} />

              <div className="grid grid-cols-2 gap-2">
                <Select value={rtKind} onValueChange={setRtKind}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND.map((k) => (
                      <SelectItem key={k.key} value={k.key}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input value={rtCap} onChange={(e) => setRtCap(e.target.value)} placeholder="Capacidad" inputMode="numeric" />
              </div>

              <Input value={rtPrice} onChange={(e) => setRtPrice(e.target.value)} placeholder="Precio base MXN" inputMode="decimal" />

              <Button className="w-full" type="submit" disabled={!rtName.trim()}>
                Agregar tipo
              </Button>
            </form>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Crear habitación</div>
            <form className="space-y-2" onSubmit={onCreateRoom}>
              <Select value={rTypeId} onValueChange={setRTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de habitación" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.capacity} pax · {mxn(t.basePriceCents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input placeholder="Nombre (Ej. 101 / Contenedor 1)" value={rName} onChange={(e) => setRName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Piso (opcional)" value={rFloor} onChange={(e) => setRFloor(e.target.value)} />
                <Input placeholder="Área (opcional)" value={rArea} onChange={(e) => setRArea(e.target.value)} />
              </div>

              <Button className="w-full" type="submit" disabled={!rName.trim() || !rTypeId}>
                Agregar habitación
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: lists */}
      <div className="space-y-4">
        {/* Room Types List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tipos de habitación</CardTitle>
              <Badge variant="secondary">{roomTypes.length}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {roomTypes.length === 0 ? (
              <div className="text-sm text-muted-foreground">Crea al menos un tipo para comenzar.</div>
            ) : (
              <div className="space-y-2">
                {roomTypes.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-1">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.kind} · {t.capacity} pax · {mxn(t.basePriceCents)}
                      </div>
                      {t.description ? <div className="text-xs text-muted-foreground">{t.description}</div> : null}
                    </div>

                    <div className="flex gap-2">
                      <EditRoomType t={t as any} onSaved={() => router.refresh()} />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm(`¿Eliminar tipo "${t.name}"? (Si tiene habitaciones asociadas, no te dejará)`)) return;
                          await deleteRoomType({ id: t.id });
                          router.refresh();
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rooms */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Habitaciones</CardTitle>
              <Badge variant="secondary">{filteredRooms.length}</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <Input placeholder="Buscar (nombre/área/tipo)" value={q} onChange={(e) => setQ(e.target.value)} />

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {STATUS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filteredRooms.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.roomType?.name} · {r.floor ? `Piso ${r.floor}` : "—"} · {r.area ?? "—"} · {r.isActive ? "Activa" : "Inactiva"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <EditRoom r={r as any} roomTypes={roomTypes as any} onSaved={() => router.refresh()} />
                    </div>
                  </div>

                  {/* status chips */}
                  <div className="flex flex-wrap gap-2">
                    {STATUS.map((s) => (
                      <Button
                        key={s.key}
                        size="sm"
                        variant={r.status === s.key ? "default" : "outline"}
                        onClick={async () => {
                          await setRoomStatus({ roomId: r.id, status: s.key as any });
                          router.refresh();
                        }}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}

              {filteredRooms.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay habitaciones con esos filtros.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EditRoomType({ t, onSaved }: { t: any; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(t.name);
  const [desc, setDesc] = React.useState(t.description ?? "");
  const [kind, setKind] = React.useState(t.kind);
  const [cap, setCap] = React.useState(String(t.capacity));
  const [price, setPrice] = React.useState(String(t.basePriceCents / 100));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tipo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND.map((k) => (
                    <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Capacidad</Label>
              <Input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="numeric" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Precio base (MXN)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </div>

          <Button
            className="w-full"
            onClick={async () => {
              await updateRoomType({
                id: t.id,
                name,
                description: desc,
                kind: kind as any,
                capacity: parseInt(cap || "1", 10),
                basePrice: parseFloat(price || "0"),
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

function EditRoom({ r, roomTypes, onSaved }: { r: any; roomTypes: any[]; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(r.name);
  const [floor, setFloor] = React.useState(r.floor ?? "");
  const [area, setArea] = React.useState(r.area ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(r.sortOrder ?? 0));
  const [roomTypeId, setRoomTypeId] = React.useState(r.roomTypeId);
  const [isActive, setIsActive] = React.useState(!!r.isActive);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar habitación</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={roomTypeId} onValueChange={setRoomTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Piso</Label>
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Activa</Label>
              <Select value={isActive ? "1" : "0"} onValueChange={(v) => setIsActive(v === "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Sí</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={async () => {
              await updateRoom({
                id: r.id,
                roomTypeId,
                name,
                floor,
                area,
                sortOrder: parseInt(sortOrder || "0", 10) || 0,
                isActive,
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
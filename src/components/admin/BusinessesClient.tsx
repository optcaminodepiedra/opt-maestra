"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Edit2, Save, X, AlertCircle, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { createBusiness, updateBusiness } from "@/lib/businesses.actions";

type BusinessRow = {
  id: string;
  name: string;
  linkedHotelBusinessId: string | null;
  linkedHotelName: string | null;
  stats: {
    sales: number;
    expenses: number;
    users: number;
    hotelRooms: number;
    restaurantTables: number;
    inventoryItems: number;
    cashpoints: number;
  };
};

type Props = {
  businesses: BusinessRow[];
};

export function BusinessesClient({ businesses: initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [businesses, setBusinesses] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLinkedHotel, setEditLinkedHotel] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLinkedHotel, setNewLinkedHotel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(b: BusinessRow) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditLinkedHotel(b.linkedHotelBusinessId ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditLinkedHotel("");
  }

  function saveEdit() {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateBusiness({
          id: editingId,
          name: editName,
          linkedHotelBusinessId: editLinkedHotel || null,
        });
        setBusinesses((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? {
                  ...b,
                  name: editName,
                  linkedHotelBusinessId: editLinkedHotel || null,
                  linkedHotelName: editLinkedHotel
                    ? prev.find((x) => x.id === editLinkedHotel)?.name ?? null
                    : null,
                }
              : b
          )
        );
        cancelEdit();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function createNew() {
    if (!newName.trim()) return setError("El nombre es requerido");
    setError(null);
    startTransition(async () => {
      try {
        const res = await createBusiness({
          name: newName,
          linkedHotelBusinessId: newLinkedHotel || null,
        });
        setBusinesses((prev) => [
          ...prev,
          {
            id: res.id,
            name: newName,
            linkedHotelBusinessId: newLinkedHotel || null,
            linkedHotelName: newLinkedHotel
              ? prev.find((x) => x.id === newLinkedHotel)?.name ?? null
              : null,
            stats: { sales: 0, expenses: 0, users: 0, hotelRooms: 0, restaurantTables: 0, inventoryItems: 0, cashpoints: 0 },
          },
        ]);
        setCreating(false);
        setNewName("");
        setNewLinkedHotel("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {businesses.length} negocio(s) registrado(s)
        </p>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo negocio
          </Button>
        )}
      </div>

      {creating && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nuevo negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Bodega 5"
                className="w-full h-9 px-3 border rounded text-sm bg-background mt-1"
                disabled={pending}
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">
                Hotel vinculado (opcional, para restaurantes que sirven a un hotel)
              </label>
              <select
                value={newLinkedHotel}
                onChange={(e) => setNewLinkedHotel(e.target.value)}
                className="w-full h-9 px-3 border rounded text-sm bg-background mt-1"
                disabled={pending}
              >
                <option value="">Ninguno</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setError(null); }} disabled={pending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={createNew} disabled={pending}>
                {pending ? "Creando..." : "Crear"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {businesses.map((b) => {
          const isEditing = editingId === b.id;
          return (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-7 px-2 border rounded text-sm"
                        disabled={pending}
                      />
                    ) : (
                      <CardTitle className="text-sm truncate">{b.name}</CardTitle>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit} disabled={pending}>
                        <Save className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit} disabled={pending}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => startEdit(b)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {isEditing ? (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Hotel vinculado</label>
                    <select
                      value={editLinkedHotel}
                      onChange={(e) => setEditLinkedHotel(e.target.value)}
                      className="w-full h-8 px-2 border rounded text-xs bg-background mt-1"
                      disabled={pending}
                    >
                      <option value="">Ninguno</option>
                      {businesses
                        .filter((x) => x.id !== b.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                    </select>
                  </div>
                ) : (
                  b.linkedHotelName && (
                    <Badge variant="outline" className="text-[10px]">
                      <LinkIcon className="w-3 h-3 mr-1" /> Vinculado a: {b.linkedHotelName}
                    </Badge>
                  )
                )}

                <div className="grid grid-cols-4 gap-2 text-[10px] mt-2 pt-2 border-t">
                  <Stat label="Ventas" value={b.stats.sales} />
                  <Stat label="Gastos" value={b.stats.expenses} />
                  <Stat label="Usuarios" value={b.stats.users} />
                  <Stat label="Cajas" value={b.stats.cashpoints} />
                  <Stat label="Habitac." value={b.stats.hotelRooms} />
                  <Stat label="Mesas" value={b.stats.restaurantTables} />
                  <Stat label="Productos" value={b.stats.inventoryItems} />
                </div>

                <p className="text-[9px] text-muted-foreground font-mono truncate pt-1">ID: {b.id}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

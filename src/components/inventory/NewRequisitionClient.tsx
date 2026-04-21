"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, AlertCircle, CheckCircle2, Package,
} from "lucide-react";
import { createRequisition } from "@/lib/requisitions.actions";

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  onHandQty: number;
  minQty: number;
  lastPriceCents: number;
  supplierName: string | null;
};

type Business = { id: string; name: string };

type Line = {
  itemId: string;
  qty: number;
  note: string;
};

type Props = {
  businesses: Business[];
  selectedBusinessId: string;
  items: InventoryItem[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function NewRequisitionClient({ businesses, selectedBusinessId, items }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [businessId, setBusinessId] = useState(selectedBusinessId);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const usedIds = useMemo(() => new Set(lines.map((l) => l.itemId)), [lines]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (usedIds.has(i.id)) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.supplierName?.toLowerCase().includes(q)
      );
    });
  }, [items, search, usedIds]);

  // Agrupar por categoría para mostrarlos ordenados
  const grouped = useMemo(() => {
    const g: Record<string, InventoryItem[]> = {};
    for (const it of filteredItems) {
      const cat = it.category ?? "Sin categoría";
      if (!g[cat]) g[cat] = [];
      g[cat].push(it);
    }
    return g;
  }, [filteredItems]);

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const estimatedTotal = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const it = itemById.get(line.itemId);
      if (it) total += line.qty * it.lastPriceCents;
    }
    return total;
  }, [lines, itemById]);

  function addLine(item: InventoryItem) {
    const suggestedQty = Math.max(item.minQty - item.onHandQty, 1);
    setLines([...lines, { itemId: item.id, qty: suggestedQty, note: "" }]);
  }

  function updateLine(itemId: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));
  }

  function removeLine(itemId: string) {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  function handleBusinessChange(newBizId: string) {
    if (lines.length > 0 && !confirm("Cambiar de negocio vaciará tu lista. ¿Continuar?")) return;
    setBusinessId(newBizId);
    setLines([]);
    router.push(`/app/inventory/requisitions/new?businessId=${newBizId}`);
  }

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Dale un título a tu requisición.");
    if (lines.length === 0) return setError("Agrega al menos un producto.");
    for (const l of lines) {
      if (l.qty <= 0) return setError("Todas las cantidades deben ser mayores a 0.");
    }

    start(async () => {
      try {
        await createRequisition({
          businessId,
          title: title.trim(),
          note: note.trim() || null,
          neededByIso: neededBy || null,
          items: lines.map((l) => ({
            itemId: l.itemId,
            qtyRequested: l.qty,
            note: l.note || null,
          })),
        });
        setSuccess(true);
        setTimeout(() => router.push("/app/inventory/requisitions"), 1200);
      } catch (err: any) {
        setError(err.message ?? "Error al crear la requisición.");
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-base font-medium">Requisición enviada</p>
          <p className="text-sm text-muted-foreground">Redirigiendo...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Columna izquierda: catálogo */}
      <div className="lg:col-span-3 space-y-3">
        {/* Selector de negocio (solo si tiene varios) */}
        {businesses.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Negocio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBusinessChange(b.id)}
                    disabled={pending}
                  >
                    <Badge
                      variant={b.id === businessId ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80"
                    >
                      {b.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buscador */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" /> Productos del almacén
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU, categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
            </div>

            <div className="mt-3 max-h-[500px] overflow-y-auto space-y-3">
              {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {items.length === 0
                    ? "No hay productos en el catálogo de este negocio."
                    : "Sin resultados."}
                </div>
              ) : (
                Object.entries(grouped).map(([cat, catItems]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 px-1">
                      {cat}
                    </p>
                    <div className="space-y-1">
                      {catItems.map((it) => {
                        const isLow = it.onHandQty <= it.minQty;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => addLine(it)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-left text-sm hover:bg-muted/30 hover:border-primary transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{it.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {it.sku ? `${it.sku} · ` : ""}
                                Stock: {it.onHandQty} {it.unit}
                                {it.minQty > 0 && ` · Mín ${it.minQty}`}
                                {it.lastPriceCents > 0 && ` · ${fmt(it.lastPriceCents)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isLow && (
                                <Badge variant="destructive" className="text-[9px]">
                                  Bajo
                                </Badge>
                              )}
                              <Plus className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columna derecha: resumen de la requisición */}
      <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">
                Título *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Compras cocina semana 15"
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">
                Fecha necesaria
              </label>
              <input
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">
                Nota para el almacenista
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Urgente, entregar en cocina, etc."
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background mt-1 resize-none"
                disabled={pending}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Productos ({lines.length})
              </CardTitle>
              {estimatedTotal > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  Est. {fmt(estimatedTotal)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Selecciona productos del catálogo para agregarlos aquí.
              </div>
            ) : (
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {lines.map((line) => {
                  const it = itemById.get(line.itemId);
                  if (!it) return null;
                  return (
                    <div key={line.itemId} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{it.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Stock: {it.onHandQty} {it.unit}
                            {it.minQty > 0 && ` · Mín ${it.minQty}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => removeLine(line.itemId)}
                          disabled={pending}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-[9px] text-muted-foreground uppercase">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) =>
                              updateLine(line.itemId, {
                                qty: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-full h-8 px-2 border rounded text-xs bg-background"
                            disabled={pending}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground uppercase">
                            Nota
                          </label>
                          <input
                            type="text"
                            value={line.note}
                            onChange={(e) =>
                              updateLine(line.itemId, { note: e.target.value })
                            }
                            placeholder="Opcional"
                            className="w-full h-8 px-2 border rounded text-xs bg-background"
                            disabled={pending}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild disabled={pending}>
            <Link href="/app/inventory/requisitions">Cancelar</Link>
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={submit}
            disabled={pending || lines.length === 0}
          >
            {pending ? "Enviando..." : `Enviar (${lines.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

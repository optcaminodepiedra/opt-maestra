"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, AlertCircle, CheckCircle2, Package,
  UtensilsCrossed, Sparkles, Home, Coffee, Layers,
  AlertTriangle, ArrowLeft, Edit3, ShoppingCart, ArrowRight,
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

type CatalogLine = {
  kind: "catalog";
  itemId: string;
  qty: number;
  note: string;
  estimatedPriceCents: number;
};

type FreeLine = {
  kind: "free";
  freeTextName: string;
  freeTextUnit: string;
  qty: number;
  note: string;
  estimatedPriceCents: number;
};

type Line = CatalogLine | FreeLine;

type RequisitionKindOption = {
  key: "RESTAURANT" | "SPECIAL_EVENT" | "OWNER_HOUSE" | "VENDING_MACHINE";
  label: string;
  description: string;
  icon: any;
  color: string;
  allowsFreeText: boolean;
  isPrivate?: boolean;
};

type Props = {
  businesses: Business[];
  selectedBusinessId: string;
  items: InventoryItem[];
  userRole: string;
  initialKind?: string;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function NewRequisitionWizard({ businesses, selectedBusinessId, items, userRole, initialKind }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const allKinds: RequisitionKindOption[] = [
    { key: "RESTAURANT",      label: "Restaurante",        description: "Insumos diarios del restaurante (solo catálogo)", icon: UtensilsCrossed, color: "blue",   allowsFreeText: false },
    { key: "SPECIAL_EVENT",   label: "Evento especial",    description: "Día de las madres, eventos, ocasiones especiales", icon: Sparkles,        color: "purple", allowsFreeText: true  },
    { key: "OWNER_HOUSE",     label: "Casa Navarro Smith", description: "Compras privadas para los dueños",                 icon: Home,            color: "amber",  allowsFreeText: true, isPrivate: true },
    { key: "VENDING_MACHINE", label: "Dispensadora",       description: "Refacciones y suministros de máquinas",            icon: Coffee,          color: "green",  allowsFreeText: true },
  ];

  // Filtrar tipos según rol
  const isAdmin = ["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(userRole);
  const isInventory = userRole === "INVENTORY";
  const availableKinds = allKinds.filter((k) => {
    if (isAdmin || isInventory) return true; // admin/Goyo todos
    // Gerentes: solo RESTAURANT y SPECIAL_EVENT
    return k.key === "RESTAURANT" || k.key === "SPECIAL_EVENT";
  });

  const [step, setStep] = useState<"kind" | "details">(initialKind ? "details" : "kind");
  const [selectedKind, setSelectedKind] = useState<RequisitionKindOption | null>(
    initialKind ? availableKinds.find((k) => k.key === initialKind) ?? null : null
  );

  // Form data
  const [businessId, setBusinessId] = useState(selectedBusinessId);
  const [title, setTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [urgentNote, setUrgentNote] = useState("");
  const [requiresSeparatePayment, setRequiresSeparatePayment] = useState(false);
  const [note, setNote] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [search, setSearch] = useState("");
  const [showFreeTextForm, setShowFreeTextForm] = useState(false);
  const [freeForm, setFreeForm] = useState({
    name: "",
    unit: "pz",
    qty: 1,
    price: 0,
    note: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const usedCatalogIds = useMemo(
    () => new Set(lines.filter((l) => l.kind === "catalog").map((l) => (l as CatalogLine).itemId)),
    [lines]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (usedCatalogIds.has(i.id)) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    });
  }, [items, search, usedCatalogIds]);

  const grouped = useMemo(() => {
    const g: Record<string, InventoryItem[]> = {};
    for (const it of filteredItems) {
      const cat = it.category ?? "Sin categoría";
      if (!g[cat]) g[cat] = [];
      g[cat].push(it);
    }
    return g;
  }, [filteredItems]);

  const estimatedTotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.qty * l.estimatedPriceCents, 0);
  }, [lines]);

  function addCatalogLine(item: InventoryItem) {
    const suggestedQty = Math.max(item.minQty - item.onHandQty, 1);
    setLines([...lines, {
      kind: "catalog",
      itemId: item.id,
      qty: suggestedQty,
      note: "",
      estimatedPriceCents: item.lastPriceCents,
    }]);
  }

  function addFreeLine() {
    if (!freeForm.name.trim()) return setError("Nombre requerido");
    if (!freeForm.unit.trim()) return setError("Unidad requerida");
    if (freeForm.qty <= 0) return setError("Cantidad inválida");
    setError(null);
    setLines([...lines, {
      kind: "free",
      freeTextName: freeForm.name,
      freeTextUnit: freeForm.unit,
      qty: freeForm.qty,
      note: freeForm.note,
      estimatedPriceCents: Math.round(freeForm.price * 100),
    }]);
    setFreeForm({ name: "", unit: "pz", qty: 1, price: 0, note: "" });
    setShowFreeTextForm(false);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } as Line : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setError(null);
    if (!selectedKind) return setError("Selecciona el tipo de requisición.");
    if (!title.trim()) return setError("El título es obligatorio.");
    if (selectedKind.key === "SPECIAL_EVENT" && !eventName.trim()) {
      return setError("Para eventos especiales, indica el nombre del evento.");
    }
    if (priority === "URGENT" && !urgentNote.trim()) {
      return setError("Si es urgente, explica por qué.");
    }
    if (lines.length === 0) return setError("Agrega al menos un producto.");

    startTransition(async () => {
      try {
        await createRequisition({
          businessId,
          kind: selectedKind.key,
          title: title.trim(),
          eventName: selectedKind.key === "SPECIAL_EVENT" ? eventName.trim() : undefined,
          priority,
          urgentNote: priority === "URGENT" ? urgentNote.trim() : undefined,
          requiresSeparatePayment,
          note: note.trim() || undefined,
          neededByIso: neededBy || undefined,
          items: lines.map((l) => {
            if (l.kind === "catalog") {
              return {
                itemId: l.itemId,
                qtyRequested: l.qty,
                note: l.note || undefined,
                estimatedPriceCents: l.estimatedPriceCents,
              };
            } else {
              return {
                freeTextName: l.freeTextName,
                freeTextUnit: l.freeTextUnit,
                qtyRequested: l.qty,
                note: l.note || undefined,
                estimatedPriceCents: l.estimatedPriceCents,
              };
            }
          }),
        });
        setSuccess(true);
        setTimeout(() => router.push("/app/inventory"), 1200);
      } catch (err: any) {
        setError(err.message ?? "Error al crear requisición.");
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

  // Paso 1: Elegir tipo
  if (step === "kind") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Qué tipo de requisición vas a crear?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {availableKinds.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => { setSelectedKind(k); setStep("details"); }}
                  className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 text-${k.color}-600`} />
                    <h3 className="font-semibold">{k.label}</h3>
                    {k.isPrivate && (
                      <Badge variant="outline" className="text-[9px] ml-auto bg-amber-50 text-amber-700 border-amber-200">
                        🔒 Privada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{k.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {k.allowsFreeText && (
                      <Badge variant="secondary" className="text-[9px]">
                        Productos libres permitidos
                      </Badge>
                    )}
                    {!k.allowsFreeText && (
                      <Badge variant="outline" className="text-[9px]">
                        Solo catálogo
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Paso 2: Detalles + items
  if (!selectedKind) return null;

  const KindIcon = selectedKind.icon;

  return (
    <div className="space-y-4">
      {/* Header con tipo seleccionado */}
      <Card>
        <CardContent className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-${selectedKind.color}-100 flex items-center justify-center`}>
              <KindIcon className={`w-4 h-4 text-${selectedKind.color}-600`} />
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedKind.label}</p>
              <p className="text-xs text-muted-foreground">{selectedKind.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep("kind")}>
            <Edit3 className="w-3.5 h-3.5 mr-1" /> Cambiar tipo
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Columna izquierda: catálogo + libre */}
        <div className="lg:col-span-3 space-y-3">
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
                      onClick={() => {
                        if (lines.length > 0 && !confirm("Cambiar de negocio vaciará tu lista. ¿Continuar?")) return;
                        setBusinessId(b.id);
                        setLines([]);
                        const url = new URL(window.location.href);
                        url.searchParams.set("businessId", b.id);
                        window.history.replaceState({}, "", url.toString());
                      }}
                      disabled={pending}
                    >
                      <Badge variant={b.id === businessId ? "default" : "outline"} className="cursor-pointer hover:opacity-80">
                        {b.name}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" /> Productos
                </CardTitle>
                {selectedKind.allowsFreeText && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFreeTextForm(!showFreeTextForm)}
                    disabled={pending}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Producto libre
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showFreeTextForm && (
                <div className="border-2 border-dashed border-purple-300 bg-purple-50/30 rounded-lg p-3 mb-3 space-y-2">
                  <p className="text-xs font-medium text-purple-700">Producto libre (no en catálogo)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del producto"
                      value={freeForm.name}
                      onChange={(e) => setFreeForm({ ...freeForm, name: e.target.value })}
                      className="h-8 px-2 border rounded text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Unidad (kg, pz, l)"
                      value={freeForm.unit}
                      onChange={(e) => setFreeForm({ ...freeForm, unit: e.target.value })}
                      className="h-8 px-2 border rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Cantidad"
                      min={1}
                      value={freeForm.qty}
                      onChange={(e) => setFreeForm({ ...freeForm, qty: parseInt(e.target.value) || 1 })}
                      className="h-8 px-2 border rounded text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Precio est. (opcional)"
                      step="0.01"
                      min={0}
                      value={freeForm.price}
                      onChange={(e) => setFreeForm({ ...freeForm, price: parseFloat(e.target.value) || 0 })}
                      className="h-8 px-2 border rounded text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Nota (opcional)"
                    value={freeForm.note}
                    onChange={(e) => setFreeForm({ ...freeForm, note: e.target.value })}
                    className="w-full h-8 px-2 border rounded text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowFreeTextForm(false)} className="h-7 text-xs">Cancelar</Button>
                    <Button size="sm" onClick={addFreeLine} className="h-7 text-xs">Agregar</Button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar en catálogo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="mt-3 max-h-[400px] overflow-y-auto space-y-3">
                {Object.keys(grouped).length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {items.length === 0
                      ? "No hay productos en el catálogo."
                      : selectedKind.allowsFreeText
                      ? "Sin resultados. Puedes agregar un producto libre arriba."
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
                              onClick={() => addCatalogLine(it)}
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
                                {isLow && <Badge variant="destructive" className="text-[9px]">Bajo</Badge>}
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

        {/* Columna derecha: detalles + lista */}
        <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Título *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selectedKind.key === "SPECIAL_EVENT" ? "Ej: Compras Día de las Madres" : "Ej: Compras semana 15"}
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                  disabled={pending}
                />
              </div>

              {selectedKind.key === "SPECIAL_EVENT" && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nombre del evento *</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Día de las Madres"
                    className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                    disabled={pending}
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Fecha necesaria</label>
                <input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                  disabled={pending}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority("NORMAL")}
                  className={`h-9 px-3 border rounded-lg text-xs font-medium transition-colors ${
                    priority === "NORMAL" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                  }`}
                  disabled={pending}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("URGENT")}
                  className={`h-9 px-3 border rounded-lg text-xs font-medium transition-colors ${
                    priority === "URGENT" ? "bg-red-600 text-white border-red-600" : "bg-background"
                  }`}
                  disabled={pending}
                >
                  🚨 Urgente
                </button>
              </div>

              {priority === "URGENT" && (
                <div>
                  <label className="text-[10px] text-red-600 uppercase">¿Por qué es urgente? *</label>
                  <textarea
                    value={urgentNote}
                    onChange={(e) => setUrgentNote(e.target.value)}
                    rows={2}
                    placeholder="Explica brevemente..."
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-red-50/30 border-red-200 mt-1 resize-none"
                    disabled={pending}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer p-2 bg-blue-50/30 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={requiresSeparatePayment}
                  onChange={(e) => setRequiresSeparatePayment(e.target.checked)}
                  disabled={pending}
                />
                <span>💳 Requiere pago aparte (genera cuenta por pagar)</span>
              </label>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Notas</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background mt-1 resize-none"
                  disabled={pending}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Productos ({lines.length})</CardTitle>
                {estimatedTotal > 0 && (
                  <span className="text-xs font-medium">{fmt(estimatedTotal)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lines.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Agrega productos del catálogo o libres.
                </div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {lines.map((line, idx) => {
                    const name = line.kind === "catalog"
                      ? itemById.get(line.itemId)?.name ?? "?"
                      : line.freeTextName;
                    const unit = line.kind === "catalog"
                      ? itemById.get(line.itemId)?.unit ?? ""
                      : line.freeTextUnit;
                    return (
                      <div key={idx} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {name}
                              {line.kind === "free" && (
                                <Badge variant="outline" className="text-[9px] ml-1.5">
                                  Libre
                                </Badge>
                              )}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{unit}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeLine(idx)} disabled={pending}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => updateLine(idx, { qty: parseInt(e.target.value) || 0 })}
                            className="h-8 px-2 border rounded text-xs"
                            disabled={pending}
                          />
                          <input
                            type="text"
                            placeholder="Nota"
                            value={line.note}
                            onChange={(e) => updateLine(idx, { note: e.target.value })}
                            className="h-8 px-2 border rounded text-xs"
                            disabled={pending}
                          />
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
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild disabled={pending}>
              <Link href="/app/inventory">Cancelar</Link>
            </Button>
            <Button size="sm" className="flex-1" onClick={submit} disabled={pending || lines.length === 0}>
              {pending ? "Enviando..." : "Enviar requisición"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

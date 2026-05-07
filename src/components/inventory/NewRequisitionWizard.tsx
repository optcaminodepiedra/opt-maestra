"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, AlertCircle, CheckCircle2, Package,
  UtensilsCrossed, Sparkles, Home, Coffee, Layers,
  AlertTriangle, ArrowLeft, Edit3, ShoppingCart, ArrowRight,
  Building2, X,
} from "lucide-react";
import { createRequisition } from "@/lib/requisitions.actions";
import { ALMACEN_GENERAL_ID, ALMACEN_GENERAL_NAME, requiresOperationalBusiness } from "@/lib/inventory-constants";

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
  emoji: string;
  icon: any;
  color: string;
  allowFreeText: boolean;
  needsBusiness: boolean;
};

const KIND_OPTIONS: RequisitionKindOption[] = [
  {
    key: "RESTAURANT",
    label: "Restaurante",
    description: "Insumos diarios para operación de restaurante",
    emoji: "🍽️",
    icon: UtensilsCrossed,
    color: "border-orange-300 bg-orange-50",
    allowFreeText: false,
    needsBusiness: true,
  },
  {
    key: "SPECIAL_EVENT",
    label: "Evento especial",
    description: "Para eventos como Día de las Madres, cumpleaños, etc.",
    emoji: "✨",
    icon: Sparkles,
    color: "border-purple-300 bg-purple-50",
    allowFreeText: true,
    needsBusiness: true,
  },
  {
    key: "OWNER_HOUSE",
    label: "Casa Navarro Smith",
    description: "Productos para la casa de los dueños (privado)",
    emoji: "🏠",
    icon: Home,
    color: "border-amber-300 bg-amber-50",
    allowFreeText: true,
    needsBusiness: false,
  },
  {
    key: "VENDING_MACHINE",
    label: "Máquina dispensadora",
    description: "Reposición de productos para máquina expendedora",
    emoji: "🥤",
    icon: Coffee,
    color: "border-cyan-300 bg-cyan-50",
    allowFreeText: true,
    needsBusiness: false,
  },
];

type Props = {
  businesses: Business[];
  selectedBusinessId: string | null;
  items: InventoryItem[];
  userRole: string;
  initialKind?: "RESTAURANT" | "SPECIAL_EVENT" | "OWNER_HOUSE" | "VENDING_MACHINE";
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function NewRequisitionWizard({
  businesses,
  selectedBusinessId: initialBusinessId,
  items,
  userRole,
  initialKind,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Determinar tipos disponibles según rol
  const isInventoryRole = ["INVENTORY", "MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(userRole);
  const availableKinds = useMemo(() => {
    if (isInventoryRole) {
      // Goyo + admins: todos
      return KIND_OPTIONS;
    }
    // Gerentes: solo RESTAURANT y SPECIAL_EVENT
    return KIND_OPTIONS.filter((k) => ["RESTAURANT", "SPECIAL_EVENT"].includes(k.key));
  }, [isInventoryRole]);

  // Estado: paso actual
  const [step, setStep] = useState<"kind" | "details">(initialKind ? "details" : "kind");
  const [kind, setKind] = useState<RequisitionKindOption | null>(
    initialKind ? KIND_OPTIONS.find((k) => k.key === initialKind) ?? null : null
  );

  // Detalles
  const [businessId, setBusinessId] = useState<string>(initialBusinessId ?? "");
  const [title, setTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [urgentNote, setUrgentNote] = useState("");
  const [requiresSeparatePayment, setRequiresSeparatePayment] = useState(false);
  const [neededByIso, setNeededByIso] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // Buscador de productos
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Errores
  const [error, setError] = useState<string | null>(null);

  // Si el tipo no requiere negocio operativo, asignar Almacén General
  useEffect(() => {
    if (kind && !kind.needsBusiness) {
      setBusinessId(ALMACEN_GENERAL_ID);
    } else if (kind && kind.needsBusiness && businessId === ALMACEN_GENERAL_ID) {
      // Si cambió a un tipo que SÍ requiere negocio, resetear
      setBusinessId(initialBusinessId ?? "");
    }
  }, [kind, initialBusinessId]);

  // Filtrar items por búsqueda
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      return (
        it.name.toLowerCase().includes(q) ||
        (it.sku ?? "").toLowerCase().includes(q) ||
        (it.category ?? "").toLowerCase().includes(q) ||
        (it.supplierName ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  // Items ya agregados (para no mostrarlos de nuevo)
  const addedItemIds = new Set(
    lines.filter((l): l is CatalogLine => l.kind === "catalog").map((l) => l.itemId)
  );

  function selectKind(k: RequisitionKindOption) {
    setKind(k);
    setStep("details");
    setError(null);
  }

  function addCatalogLine(item: InventoryItem) {
    if (addedItemIds.has(item.id)) return;
    setLines((prev) => [
      ...prev,
      {
        kind: "catalog",
        itemId: item.id,
        qty: 1,
        note: "",
        estimatedPriceCents: item.lastPriceCents,
      },
    ]);
    setSearch("");
    setShowSearch(false);
  }

  function addFreeLine() {
    setLines((prev) => [
      ...prev,
      {
        kind: "free",
        freeTextName: "",
        freeTextUnit: "pz",
        qty: 1,
        note: "",
        estimatedPriceCents: 0,
      },
    ]);
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } as Line : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function getItemById(id: string) {
    return items.find((i) => i.id === id);
  }

  // Total estimado
  const totalCents = lines.reduce((sum, l) => sum + l.qty * l.estimatedPriceCents, 0);

  function submit() {
    if (!kind) return setError("Selecciona un tipo de requisición");
    if (!title.trim()) return setError("Agrega un título");
    if (kind.needsBusiness && !businessId) return setError("Selecciona un negocio");
    if (kind.key === "SPECIAL_EVENT" && !eventName.trim()) return setError("Agrega el nombre del evento");
    if (priority === "URGENT" && !urgentNote.trim()) return setError("Las requisiciones URGENTES requieren explicar por qué");
    if (lines.length === 0) return setError("Agrega al menos un producto");

    // Validar líneas
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.qty <= 0) return setError(`Línea ${i + 1}: cantidad inválida`);
      if (l.kind === "free") {
        if (!l.freeTextName.trim()) return setError(`Línea ${i + 1}: falta nombre del producto`);
        if (!l.freeTextUnit.trim()) return setError(`Línea ${i + 1}: falta unidad`);
      }
    }

    setError(null);

    start(async () => {
      try {
        const payload = {
          businessId,
          kind: kind.key,
          title: title.trim(),
          eventName: eventName.trim() || undefined,
          priority,
          urgentNote: priority === "URGENT" ? urgentNote.trim() : undefined,
          requiresSeparatePayment,
          note: generalNote.trim() || undefined,
          neededByIso: neededByIso || undefined,
          items: lines.map((l) => {
            if (l.kind === "catalog") {
              return {
                itemId: l.itemId,
                qtyRequested: l.qty,
                note: l.note.trim() || undefined,
                estimatedPriceCents: l.estimatedPriceCents,
              };
            }
            return {
              freeTextName: l.freeTextName.trim(),
              freeTextUnit: l.freeTextUnit.trim(),
              qtyRequested: l.qty,
              note: l.note.trim() || undefined,
              estimatedPriceCents: l.estimatedPriceCents,
            };
          }),
        };
        const res = await createRequisition(payload as any);
        router.push(`/app/inventory/requisitions/${res.requisitionId}`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  /* ═══════════════════════════ Step 1: elegir tipo ═══════════════════════════ */

  if (step === "kind") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Qué tipo de requisición?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {availableKinds.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.key}
                  onClick={() => selectKind(k)}
                  className={`text-left border-2 rounded-lg p-4 transition hover:border-primary hover:bg-muted/20 ${k.color}`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{k.emoji}</span>
                    <h3 className="font-semibold">{k.label}</h3>
                    <Icon className="w-4 h-4 ml-auto text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">{k.description}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {k.allowFreeText && (
                      <Badge variant="outline" className="text-[9px] bg-white">
                        Productos libres ✓
                      </Badge>
                    )}
                    {!k.needsBusiness && (
                      <Badge variant="outline" className="text-[9px] bg-white">
                        Sin negocio
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {availableKinds.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Tu rol no tiene permisos para crear requisiciones.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ═══════════════════════════ Step 2: detalles ═══════════════════════════ */

  if (!kind) return null;
  const KindIcon = kind.icon;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setStep("kind")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Cambiar tipo
      </Button>

      <Card className={kind.color}>
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{kind.emoji}</span>
            <div>
              <p className="font-semibold">{kind.label}</p>
              <p className="text-xs text-muted-foreground">{kind.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos generales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Datos de la requisición</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase">Título *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Insumos cocina semana 23"
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
              />
            </div>

            {/* Negocio - SOLO si el tipo lo requiere */}
            {kind.needsBusiness && (
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase">Negocio *</label>
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                >
                  <option value="">— Selecciona —</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!kind.needsBusiness && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 text-xs bg-muted/30 border rounded-lg p-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Esta requisición se asocia a <strong>{ALMACEN_GENERAL_NAME}</strong> (no a un negocio operativo)
                  </span>
                </div>
              </div>
            )}

            {/* Nombre del evento - SOLO para SPECIAL_EVENT */}
            {kind.key === "SPECIAL_EVENT" && (
              <div className="md:col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase">
                  Nombre del evento *
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ej: Día de las Madres, Cumpleaños VIP, Boda Sánchez..."
                  className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Fecha límite (opcional)</label>
              <input
                type="date"
                value={neededByIso}
                onChange={(e) => setNeededByIso(e.target.value)}
                className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Prioridad</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setPriority("NORMAL")}
                  className={`h-9 border rounded-lg text-sm transition ${
                    priority === "NORMAL" ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/30"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("URGENT")}
                  className={`h-9 border rounded-lg text-sm transition flex items-center justify-center gap-1 ${
                    priority === "URGENT" ? "border-red-400 bg-red-50 font-medium text-red-700" : "hover:bg-muted/30"
                  }`}
                >
                  🚨 Urgente
                </button>
              </div>
            </div>
          </div>

          {/* Razón de urgencia */}
          {priority === "URGENT" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <label className="text-[10px] text-red-700 uppercase font-semibold">
                ¿Por qué es urgente? *
              </label>
              <textarea
                value={urgentNote}
                onChange={(e) => setUrgentNote(e.target.value)}
                placeholder="Explica brevemente la urgencia"
                className="w-full p-2 border rounded text-sm bg-white mt-1 min-h-[60px]"
              />
            </div>
          )}

          {/* Pago aparte */}
          <div className="flex items-start gap-2 p-3 border rounded-lg bg-muted/20">
            <input
              type="checkbox"
              id="reqPayment"
              checked={requiresSeparatePayment}
              onChange={(e) => setRequiresSeparatePayment(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="reqPayment" className="text-sm cursor-pointer">
              <strong>Requiere pago aparte</strong>
              <p className="text-xs text-muted-foreground mt-0.5">
                Si lo marcas, al aprobar esta requisición se creará automáticamente una cuenta por pagar para que la contadora la procese.
              </p>
            </label>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Notas generales (opcional)</label>
            <textarea
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Información adicional para Goyo..."
              className="w-full p-2 border rounded-lg text-sm bg-background mt-1 min-h-[60px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" /> Productos solicitados
              {lines.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {lines.length} línea(s)
                </Badge>
              )}
            </CardTitle>
            {totalCents > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Total estimado: <strong className="text-foreground">{fmt(totalCents)}</strong>
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSearch((v) => !v)}
            >
              <Search className="w-3.5 h-3.5 mr-1" /> Catálogo
            </Button>
            {kind.allowFreeText && (
              <Button size="sm" variant="outline" onClick={addFreeLine}>
                <Edit3 className="w-3.5 h-3.5 mr-1" /> Producto libre
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Buscador de productos */}
          {showSearch && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-2 bg-muted/30 border-b">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSearch(""); setShowSearch(false); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-2" />
                    Este negocio no tiene productos en el catálogo todavía.
                    {kind.allowFreeText && (
                      <p className="text-xs mt-1">Usa "Producto libre" para agregar items que no estén en el catálogo.</p>
                    )}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Sin resultados para "{search}"
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredItems.slice(0, 30).map((it) => {
                      const alreadyAdded = addedItemIds.has(it.id);
                      return (
                        <button
                          key={it.id}
                          onClick={() => addCatalogLine(it)}
                          disabled={alreadyAdded}
                          className={`w-full text-left p-2.5 hover:bg-muted/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">{it.name}</p>
                              {it.sku && (
                                <Badge variant="outline" className="text-[9px]">{it.sku}</Badge>
                              )}
                              {it.category && (
                                <Badge variant="secondary" className="text-[9px]">{it.category}</Badge>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Stock: {it.onHandQty} {it.unit.toLowerCase()}
                              {it.lastPriceCents > 0 && ` · ${fmt(it.lastPriceCents)} c/u`}
                              {it.supplierName && ` · ${it.supplierName}`}
                            </p>
                          </div>
                          {alreadyAdded ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                              Agregado
                            </Badge>
                          ) : (
                            <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      );
                    })}
                    {filteredItems.length > 30 && (
                      <div className="p-2 text-center text-[10px] text-muted-foreground bg-muted/20">
                        Mostrando 30 de {filteredItems.length}. Refina la búsqueda.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Líneas agregadas */}
          {lines.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <ShoppingCart className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aún no has agregado productos
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Usa los botones de arriba para agregar del catálogo o productos libres
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, idx) => {
                if (line.kind === "catalog") {
                  const item = getItemById(line.itemId);
                  if (!item) return null;
                  return (
                    <div key={idx} className="border rounded-lg p-3 bg-blue-50/30">
                      <div className="flex items-start gap-3">
                        <Package className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{item.name}</p>
                            <Badge variant="outline" className="text-[9px]">Catálogo</Badge>
                            {item.sku && <Badge variant="secondary" className="text-[9px]">{item.sku}</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Stock actual: {item.onHandQty} {item.unit.toLowerCase()}
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Cantidad</label>
                              <input
                                type="number"
                                min="1"
                                value={line.qty}
                                onChange={(e) => updateLine(idx, { qty: parseInt(e.target.value) || 0 })}
                                className="w-full h-8 px-2 border rounded text-sm bg-background"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Precio est. (c/u)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.estimatedPriceCents / 100}
                                onChange={(e) => updateLine(idx, {
                                  estimatedPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                                })}
                                className="w-full h-8 px-2 border rounded text-sm bg-background"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground uppercase">Subtotal</label>
                              <p className="h-8 px-2 flex items-center text-sm font-medium">
                                {fmt(line.qty * line.estimatedPriceCents)}
                              </p>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={line.note}
                            onChange={(e) => updateLine(idx, { note: e.target.value })}
                            placeholder="Nota (opcional)"
                            className="w-full h-8 px-2 border rounded text-xs bg-background mt-2"
                          />
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLine(idx)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Free line
                return (
                  <div key={idx} className="border rounded-lg p-3 bg-purple-50/30">
                    <div className="flex items-start gap-3">
                      <Edit3 className="w-4 h-4 text-purple-600 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="text-[9px] mb-2">Producto libre</Badge>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-muted-foreground uppercase">Nombre del producto</label>
                            <input
                              type="text"
                              value={line.freeTextName}
                              onChange={(e) => updateLine(idx, { freeTextName: e.target.value })}
                              placeholder="Ej: Vino tinto importado"
                              className="w-full h-8 px-2 border rounded text-sm bg-background"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground uppercase">Unidad</label>
                            <input
                              type="text"
                              value={line.freeTextUnit}
                              onChange={(e) => updateLine(idx, { freeTextUnit: e.target.value })}
                              placeholder="kg, pz, l"
                              className="w-full h-8 px-2 border rounded text-sm bg-background"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground uppercase">Cantidad</label>
                            <input
                              type="number"
                              min="1"
                              value={line.qty}
                              onChange={(e) => updateLine(idx, { qty: parseInt(e.target.value) || 0 })}
                              className="w-full h-8 px-2 border rounded text-sm bg-background"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground uppercase">Precio est. (c/u)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.estimatedPriceCents / 100}
                              onChange={(e) => updateLine(idx, {
                                estimatedPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                              })}
                              className="w-full h-8 px-2 border rounded text-sm bg-background"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={line.note}
                          onChange={(e) => updateLine(idx, { note: e.target.value })}
                          placeholder="Nota (opcional)"
                          className="w-full h-8 px-2 border rounded text-xs bg-background mt-2"
                        />
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => removeLine(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Errores y submit */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" asChild disabled={pending}>
          <Link href="/app/inventory">Cancelar</Link>
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Enviando..." : "Enviar requisición"}
        </Button>
      </div>
    </div>
  );
}

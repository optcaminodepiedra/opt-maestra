"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, Search, AlertTriangle, AlertCircle, TrendingUp, TrendingDown,
  ArrowUpDown, Plus, X, Filter, DollarSign, PackageX, Boxes, CheckCircle2,
  ArrowRight, Building2,
} from "lucide-react";
import { createInventoryMovement } from "@/lib/inventory.actions";

type StockItem = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  onHandQty: number;
  minQty: number;
  lastPriceCents: number;
  supplierName: string | null;
  totalValueCents: number;
  belowMin: boolean;
  outOfStock: boolean;
};

type Summary = {
  totalItems: number;
  belowMin: number;
  outOfStock: number;
  totalValueCents: number;
};

type Business = { id: string; name: string };

type Props = {
  items: StockItem[];
  summary: Summary;
  categories: string[];
  businessId: string;
  businessName: string;
  destinationBusinesses: Business[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    cents / 100
  );

export function StockClient({
  items,
  summary,
  categories,
  businessId,
  businessName,
  destinationBusinesses,
}: Props) {
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");

  // Modal de movimiento
  const [movingItem, setMovingItem] = useState<StockItem | null>(null);
  const [moveType, setMoveType] = useState<"IN" | "OUT" | "ADJUST">("IN");
  const [moveQty, setMoveQty] = useState<string>("");
  const [moveNote, setMoveNote] = useState("");
  const [moveDestination, setMoveDestination] = useState<string>("");
  const [moveError, setMoveError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inName = it.name.toLowerCase().includes(q);
        const inSku = (it.sku ?? "").toLowerCase().includes(q);
        const inSupplier = (it.supplierName ?? "").toLowerCase().includes(q);
        if (!inName && !inSku && !inSupplier) return false;
      }
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (stockFilter === "LOW" && !it.belowMin) return false;
      if (stockFilter === "OUT" && !it.outOfStock) return false;
      return true;
    });
  }, [items, search, categoryFilter, stockFilter]);

  function openMoveModal(item: StockItem, type: "IN" | "OUT" | "ADJUST" = "IN") {
    setMovingItem(item);
    setMoveType(type);
    setMoveQty("");
    setMoveNote("");
    setMoveDestination("");
    setMoveError(null);
  }

  function closeMoveModal() {
    setMovingItem(null);
    setMoveQty("");
    setMoveNote("");
    setMoveDestination("");
    setMoveError(null);
  }

  function submitMove() {
    if (!movingItem) return;
    const qty = parseInt(moveQty);
    if (isNaN(qty) || qty <= 0) {
      setMoveError("Cantidad inválida");
      return;
    }
    setMoveError(null);
    start(async () => {
      try {
        await createInventoryMovement({
          itemId: movingItem.id,
          type: moveType,
          qty,
          note: moveNote.trim() || undefined,
          destinationBusinessId:
            moveType === "OUT" && moveDestination ? moveDestination : null,
        });
        closeMoveModal();
        // Refrescar la página
        window.location.reload();
      } catch (err: any) {
        setMoveError(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Productos</CardTitle>
            <Boxes className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">en catálogo</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Valor total</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(summary.totalValueCents)}</div>
            <p className="text-xs text-muted-foreground">en stock actual</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bajo mínimo</CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-amber-700">{summary.belowMin}</div>
            <p className="text-xs text-muted-foreground">productos a reponer</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sin stock</CardTitle>
            <PackageX className="h-3.5 w-3.5 text-red-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-red-700">{summary.outOfStock}</div>
            <p className="text-xs text-muted-foreground">agotados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o proveedor..."
                className="w-full h-9 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 border rounded-lg text-sm bg-background"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {(["ALL", "LOW", "OUT"] as const).map((f) => {
                const labels = { ALL: "Todos", LOW: "Bajo mínimo", OUT: "Sin stock" };
                return (
                  <Button
                    key={f}
                    size="sm"
                    variant={stockFilter === f ? "default" : "outline"}
                    onClick={() => setStockFilter(f)}
                    className="flex-1 h-9 text-xs"
                  >
                    {labels[f]}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {filtered.length} producto(s) {filtered.length !== items.length && `de ${items.length}`}
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              <Building2 className="w-3 h-3 mr-1" /> {businessName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {items.length === 0 ? "No hay productos en el catálogo" : "Sin resultados con esos filtros"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Producto</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Categoría</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Stock</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Mín</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Precio U</th>
                    <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Valor total</th>
                    <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((it) => (
                    <tr
                      key={it.id}
                      className={`hover:bg-muted/20 ${
                        it.outOfStock ? "bg-red-50/30" : it.belowMin ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-medium">{it.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            {it.sku && <span>SKU: {it.sku}</span>}
                            {it.supplierName && <span>· {it.supplierName}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {it.category || "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-semibold ${
                            it.outOfStock ? "text-red-700" : it.belowMin ? "text-amber-700" : ""
                          }`}>
                            {it.onHandQty}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{it.unit.toLowerCase()}</span>
                          {it.outOfStock && <PackageX className="w-3.5 h-3.5 text-red-500" />}
                          {!it.outOfStock && it.belowMin && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                        {it.minQty || "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-xs">
                        {it.lastPriceCents > 0 ? fmt(it.lastPriceCents) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-medium">
                        {it.totalValueCents > 0 ? fmt(it.totalValueCents) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openMoveModal(it, "IN")}
                            title="Entrada"
                          >
                            <TrendingUp className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openMoveModal(it, "OUT")}
                            disabled={it.onHandQty === 0}
                            title="Salida"
                          >
                            <TrendingDown className="w-3 h-3 text-red-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openMoveModal(it, "ADJUST")}
                            title="Ajustar"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de movimiento */}
      {movingItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {moveType === "IN" && <TrendingUp className="w-5 h-5 text-green-600" />}
                  {moveType === "OUT" && <TrendingDown className="w-5 h-5 text-red-600" />}
                  {moveType === "ADJUST" && <ArrowUpDown className="w-5 h-5 text-amber-600" />}
                  {moveType === "IN" ? "Entrada" : moveType === "OUT" ? "Salida" : "Ajuste"} de stock
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={closeMoveModal}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {movingItem.name}
                <span className="text-xs ml-2">
                  (Stock actual: <strong>{movingItem.onHandQty} {movingItem.unit.toLowerCase()}</strong>)
                </span>
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tipo de movimiento */}
              <div className="grid grid-cols-3 gap-1">
                {(["IN", "OUT", "ADJUST"] as const).map((t) => {
                  const labels = { IN: "Entrada", OUT: "Salida", ADJUST: "Ajuste" };
                  const icons = { IN: TrendingUp, OUT: TrendingDown, ADJUST: ArrowUpDown };
                  const colors = { IN: "text-green-600", OUT: "text-red-600", ADJUST: "text-amber-600" };
                  const Icon = icons[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setMoveType(t)}
                      className={`border rounded-lg p-2 flex flex-col items-center gap-1 text-xs transition ${
                        moveType === t ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${colors[t]}`} />
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Cantidad ({movingItem.unit.toLowerCase()})</label>
                <input
                  type="number"
                  min="1"
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="w-full h-10 px-3 border rounded-lg text-base bg-background mt-1"
                  autoFocus
                />
              </div>

              {/* Solo para SALIDA: dropdown de destino */}
              {moveType === "OUT" && destinationBusinesses.length > 0 && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    Entregar a (opcional)
                  </label>
                  <select
                    value={moveDestination}
                    onChange={(e) => setMoveDestination(e.target.value)}
                    className="w-full h-9 px-3 border rounded-lg text-sm bg-background mt-1"
                  >
                    <option value="">— Sin destino específico —</option>
                    {destinationBusinesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Útil cuando entregas producto a un negocio o gerente específico
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">
                  Nota {moveType === "ADJUST" && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  placeholder={
                    moveType === "IN"
                      ? "Ej: Compra a proveedor, recepción de pedido..."
                      : moveType === "OUT"
                      ? "Ej: Entrega a Bodega 4..."
                      : "Ej: Ajuste por inventario físico, merma..."
                  }
                  className="w-full p-2 border rounded-lg text-sm bg-background mt-1 min-h-[60px]"
                />
              </div>

              {moveError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {moveError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeMoveModal} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={submitMove} disabled={pending}>
                  {pending ? "Guardando..." : "Confirmar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

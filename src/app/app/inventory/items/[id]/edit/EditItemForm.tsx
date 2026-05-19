"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Save, Trash2, RotateCcw, AlertCircle, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { updateInventoryItem, deactivateInventoryItem, reactivateInventoryItem } from "@/lib/inventory.actions";

type Item = {
  id: string;
  businessId: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  onHandQty: number;
  minQty: number;
  maxQty: number;
  lastPriceCents: number;
  supplierName: string | null;
  notes: string | null;
  isActive: boolean;
};

export default function EditItemForm({ item }: { item: Item }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Estado local de campos
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [unit, setUnit] = useState(item.unit);
  const [minQty, setMinQty] = useState(String(item.minQty));
  const [maxQty, setMaxQty] = useState(String(item.maxQty));
  const [price, setPrice] = useState((item.lastPriceCents / 100).toFixed(2));
  const [supplierName, setSupplierName] = useState(item.supplierName ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const minQtyNum = parseInt(minQty) || 0;
    const maxQtyNum = parseInt(maxQty) || 0;
    const priceCents = price ? Math.round(parseFloat(price) * 100) : 0;

    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (maxQtyNum > 0 && maxQtyNum < minQtyNum) {
      setError("El stock máximo no puede ser menor al mínimo.");
      return;
    }

    start(async () => {
      try {
        await updateInventoryItem({
          id: item.id,
          name,
          sku: sku.trim() || null,
          category: category.trim() || null,
          unit: unit as any,
          minQty: minQtyNum,
          maxQty: maxQtyNum,
          lastPriceCents: priceCents,
          supplierName: supplierName.trim() || null,
          notes: notes.trim() || null,
        });
        setSuccess("Cambios guardados correctamente.");
        router.refresh();
        // Volver al stock tras 600ms
        setTimeout(() => {
          router.push(`/app/inventory/stock?businessId=${item.businessId}`);
        }, 600);
      } catch (err: any) {
        setError(err.message || "Error al guardar.");
      }
    });
  };

  const handleDeactivate = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    start(async () => {
      try {
        await deactivateInventoryItem(item.id);
        router.push(`/app/inventory/stock?businessId=${item.businessId}`);
      } catch (err: any) {
        setError(err.message || "Error al desactivar.");
        setConfirmDelete(false);
      }
    });
  };

  const handleReactivate = () => {
    setError(null);
    start(async () => {
      try {
        await reactivateInventoryItem(item.id);
        router.push(`/app/inventory/stock?businessId=${item.businessId}`);
      } catch (err: any) {
        setError(err.message || "Error al reactivar.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {!item.isActive && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-sm font-medium">
                Este producto está desactivado y no aparece en el listado activo.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleReactivate} disabled={pending}>
              <RotateCcw className="w-4 h-4 mr-1" /> Reactivar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-t-4 border-t-amber-500">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre y Categoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nombre del producto <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ej. Tequila Don Julio 70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej. Licores, Abarrotes..."
                />
              </div>
            </div>

            {/* SKU y Unidad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">Código SKU o de barras</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej. 7501001122334"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">
                  Unidad de medida <span className="text-red-500">*</span>
                </Label>
                <select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="PIECE">Pieza (PZA)</option>
                  <option value="KG">Kilogramo (KG)</option>
                  <option value="LT">Litro (LT)</option>
                  <option value="BOX">Caja (CAJA)</option>
                  <option value="PACK">Paquete (PACK)</option>
                </select>
              </div>
            </div>

            <div className="border-t pb-2 pt-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-4 uppercase tracking-wider">
                Compras, alertas y precios
              </h3>
            </div>

            {/* Mínimo, Máximo, Costo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minQty">
                  Stock mínimo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="minQty"
                  type="number"
                  min="0"
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Alerta cuando el stock baje a este nivel.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxQty">Stock máximo</Label>
                <Input
                  id="maxQty"
                  type="number"
                  min="0"
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Tope ideal de stock. 0 = sin tope.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Costo estimado ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ej. 850.50"
                />
              </div>
            </div>

            {/* Proveedor y notas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Proveedor habitual</Label>
                <Input
                  id="supplierName"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ej. Sam's Club, Coca Cola..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onHand">Stock actual</Label>
                <Input
                  id="onHand"
                  value={`${item.onHandQty} ${item.unit.toLowerCase()}`}
                  disabled
                  className="bg-muted/30"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se ajusta solo desde Stock → Entradas/Salidas/Ajuste.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas / descripción</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional, presentación, marca, observaciones..."
                className="w-full p-3 border rounded-md text-sm bg-background min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
                <Save className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-2 border-t">
              <div>
                {item.isActive && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-700">¿Desactivar este producto?</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleDeactivate}
                        disabled={pending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Sí, desactivar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleDeactivate}
                      disabled={pending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Desactivar producto
                    </Button>
                  )
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/app/inventory/stock?businessId=${item.businessId}`)}
                  disabled={pending}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  <Save className="w-4 h-4 mr-1" />
                  {pending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

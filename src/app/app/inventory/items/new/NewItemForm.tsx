"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, AlertCircle, Building2 } from "lucide-react";
import { createInventoryItem } from "@/lib/inventory.actions";

type Business = { id: string; name: string };

export default function NewItemForm({
  businessId,
  businessName,
  allBusinesses,
  isGlobal,
}: {
  businessId: string;
  businessName: string;
  allBusinesses: Business[];
  isGlobal: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Estado del form
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("PIECE");
  const [onHandQty, setOnHandQty] = useState("0");
  const [minQty, setMinQty] = useState("0");
  const [maxQty, setMaxQty] = useState("0");
  const [price, setPrice] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    const minQtyNum = parseInt(minQty) || 0;
    const maxQtyNum = parseInt(maxQty) || 0;
    const onHandNum = parseInt(onHandQty) || 0;
    const priceCents = price ? Math.round(parseFloat(price) * 100) : 0;

    if (maxQtyNum > 0 && maxQtyNum < minQtyNum) {
      setError("El stock máximo no puede ser menor al mínimo.");
      return;
    }

    start(async () => {
      try {
        const result = await createInventoryItem({
          businessId: selectedBusinessId,
          name,
          sku: sku.trim() || undefined,
          category: category.trim() || undefined,
          unit: unit as any,
          onHandQty: onHandNum,
          minQty: minQtyNum,
          maxQty: maxQtyNum,
          lastPriceCents: priceCents,
          supplierName: supplierName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        router.push(`/app/inventory/stock?businessId=${selectedBusinessId}`);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Error al guardar.");
      }
    });
  };

  return (
    <Card className="shadow-sm border-t-4 border-t-primary">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selector de negocio destino (solo para roles globales) */}
          {isGlobal && allBusinesses.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="businessSelect" className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                Guardar en negocio <span className="text-red-500">*</span>
              </Label>
              <select
                id="businessSelect"
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                required
              >
                {allBusinesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

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
                placeholder="Ej. Tequila Don Julio 70"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej. Licores, Abarrotes, Limpieza..."
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
              Stock y alertas
            </h3>
          </div>

          {/* Stock inicial, Mínimo, Máximo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="onHandQty">Stock inicial</Label>
              <Input
                id="onHandQty"
                type="number"
                min="0"
                value={onHandQty}
                onChange={(e) => setOnHandQty(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Cantidad con la que arranca. Se registra un movimiento "IN".
              </p>
            </div>
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
                Alerta de reabasto.
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
                Tope ideal. 0 = sin tope.
              </p>
            </div>
          </div>

          <div className="border-t pb-2 pt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4 uppercase tracking-wider">
              Compras y referencias
            </h3>
          </div>

          {/* Costo y Proveedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="supplierName">Proveedor habitual</Label>
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej. Sam's Club, Coca Cola..."
              />
            </div>
          </div>

          {/* Notas */}
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

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/app/inventory/stock?businessId=${selectedBusinessId}`)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <Save className="w-4 h-4 mr-2" />
              {pending ? "Guardando..." : "Crear producto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

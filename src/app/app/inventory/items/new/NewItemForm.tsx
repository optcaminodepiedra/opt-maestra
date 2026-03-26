"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createInventoryItem } from "@/lib/inventory.actions";
import { Save } from "lucide-react";

export default function NewItemForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const sku = formData.get("sku") as string;
    const category = formData.get("category") as string;
    const unit = formData.get("unit") as "PIECE" | "KG" | "LT" | "BOX" | "PACK";
    const minQty = parseInt(formData.get("minQty") as string) || 0;
    
    // Convertimos los pesos (ej. 45.50) a centavos enteros (4550) para la base de datos
    const priceStr = formData.get("price") as string;
    const lastPriceCents = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
    
    const supplierName = formData.get("supplierName") as string;

    try {
      await createInventoryItem({
        businessId,
        name,
        sku,
        category,
        unit,
        minQty,
        lastPriceCents,
        supplierName
      });
      alert("¡Producto guardado exitosamente en el catálogo!");
      router.push("/app/inventory");
      router.refresh();
    } catch (error) {
      alert("Error al guardar el producto. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-t-4 border-t-primary">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Fila 1: Nombre y Categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto <span className="text-red-500">*</span></Label>
              <Input id="name" name="name" placeholder="Ej. Tequila Don Julio 70" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input id="category" name="category" placeholder="Ej. Licores, Abarrotes, Limpieza..." />
            </div>
          </div>

          {/* Fila 2: SKU y Unidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">Código SKU o Barras</Label>
              <Input id="sku" name="sku" placeholder="Ej. 7501001122334" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidad de Medida <span className="text-red-500">*</span></Label>
              <select 
                id="unit" 
                name="unit" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <h3 className="font-semibold text-sm text-muted-foreground mb-4 uppercase tracking-wider">Compras y Alertas</h3>
          </div>

          {/* Fila 3: Mínimo, Costo y Proveedor */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minQty">Alerta de Stock Mínimo <span className="text-red-500">*</span></Label>
              <Input id="minQty" name="minQty" type="number" min="0" placeholder="Ej. 5" required />
              <p className="text-[10px] text-muted-foreground leading-tight">El sistema te avisará cuando haya esta cantidad o menos.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Costo Estimado ($)</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="Ej. 850.50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierName">Proveedor Habitual</Label>
              <Input id="supplierName" name="supplierName" placeholder="Ej. Sam's Club, Coca Cola..." />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Guardar en Catálogo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
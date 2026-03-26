"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createInventoryMovement } from "@/lib/inventory.actions";
import { Save, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default function MovementForm({ businessId, userId, items }: { businessId: string, userId: string, items: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const itemId = formData.get("itemId") as string;
    const qty = parseInt(formData.get("qty") as string);
    const note = formData.get("note") as string;

    try {
      await createInventoryMovement({
        businessId,
        userId,
        itemId,
        type: movementType,
        qty,
        note
      });
      alert(`¡Movimiento registrado con éxito!`);
      router.push("/app/inventory");
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Error al registrar movimiento.");
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="p-12 text-center">
          <p className="text-lg text-muted-foreground">No tienes productos en tu catálogo.</p>
          <p className="text-sm text-muted-foreground mb-4">Debes dar de alta productos antes de registrar movimientos.</p>
          <Button onClick={() => router.push("/app/inventory/items/new")}>Crear mi primer producto</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-sm border-t-4 transition-colors ${movementType === 'IN' ? 'border-t-green-500' : 'border-t-red-500'}`}>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SELECTOR DE TIPO DE MOVIMIENTO */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div 
              onClick={() => setMovementType("IN")}
              className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${movementType === 'IN' ? 'border-green-500 bg-green-50/50 text-green-700' : 'border-muted text-muted-foreground hover:bg-muted/30'}`}
            >
              <ArrowDownToLine className="w-8 h-8" />
              <span className="font-bold">ENTRADA (Sumar)</span>
              <span className="text-xs text-center">Llegada de compras, devoluciones</span>
            </div>
            
            <div 
              onClick={() => setMovementType("OUT")}
              className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all ${movementType === 'OUT' ? 'border-red-500 bg-red-50/50 text-red-700' : 'border-muted text-muted-foreground hover:bg-muted/30'}`}
            >
              <ArrowUpFromLine className="w-8 h-8" />
              <span className="font-bold">SALIDA (Restar)</span>
              <span className="text-xs text-center">Mermas, traspasos a cocina, roturas</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemId">Producto <span className="text-red-500">*</span></Label>
            <select 
              id="itemId" 
              name="itemId" 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              required
            >
              <option value="">Selecciona un producto del catálogo...</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} (Actual: {item.onHandQty} {item.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty">Cantidad Físicas a {movementType === 'IN' ? 'Sumar' : 'Restar'} <span className="text-red-500">*</span></Label>
              <Input id="qty" name="qty" type="number" min="1" placeholder="Ej. 10" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Nota / Comentarios (Opcional)</Label>
              <Input id="note" name="note" placeholder={movementType === 'IN' ? 'Ej. Factura #4451' : 'Ej. Botella rota en barra'} />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={loading} className={`w-full sm:w-auto text-white ${movementType === 'IN' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Registrando..." : `Confirmar ${movementType === 'IN' ? 'Entrada' : 'Salida'}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
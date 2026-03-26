"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, Clock, Package } from "lucide-react";
import { approveRequisition, deleteRequisition } from "@/lib/inventory.actions";

export default function RequisitionsTable({ data, userId }: { data: any[], userId: string }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    if (!confirm("¿Aprobar esta solicitud para que pase a la lista de compras?")) return;
    setLoadingId(id);
    try {
      await approveRequisition(id, userId);
    } catch (error) {
      alert("Error al aprobar.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Descartar y eliminar esta solicitud?")) return;
    setLoadingId(id);
    try {
      await deleteRequisition(id);
    } catch (error) {
      alert("Error al eliminar.");
    } finally {
      setLoadingId(null);
    }
  };

  if (data.length === 0) {
    return (
      <Card className="shadow-sm border-dashed">
        <CardContent className="p-12 text-center text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-lg font-medium">No hay solicitudes pendientes.</p>
          <p className="text-sm">Todo el almacén está al día.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((req) => {
        const isLoading = loadingId === req.id;
        const isApproved = req.status === "APPROVED";

        return (
          <Card key={req.id} className={`shadow-sm overflow-hidden transition-all ${isLoading ? 'opacity-50' : ''} ${isApproved ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-orange-500'}`}>
            <div className="flex flex-col md:flex-row">
              
              {/* INFO PRINCIPAL */}
              <div className="p-4 md:w-1/3 bg-muted/10 border-r flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  {isApproved ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">Aprobado</Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">Pendiente</Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(req.createdAt).toLocaleDateString("es-MX")}
                  </span>
                </div>
                <h3 className="font-bold text-lg leading-tight">{req.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">Solicitado por: {req.createdBy?.fullName || "Sistema"}</p>
              </div>

              {/* LISTA DE PRODUCTOS (ITEMS) */}
              <div className="p-4 md:w-1/2 flex flex-col justify-center">
                <div className="space-y-2">
                  {req.items.map((reqItem: any) => (
                    <div key={reqItem.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 font-medium">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        {reqItem.item.name}
                      </div>
                      <div className="text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {reqItem.qtyRequested} {reqItem.item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACCIONES */}
              <div className="p-4 md:w-1/6 flex md:flex-col items-center justify-end md:justify-center gap-2 bg-muted/5">
                {!isApproved && (
                  <Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)} disabled={isLoading}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full text-red-600 hover:bg-red-50" onClick={() => handleDelete(req.id)} disabled={isLoading}>
                  <Trash2 className="w-4 h-4 mr-1" /> Descartar
                </Button>
              </div>

            </div>
          </Card>
        );
      })}
    </div>
  );
}
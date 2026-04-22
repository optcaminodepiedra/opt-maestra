"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, RotateCcw, AlertCircle, Clock, Undo2,
  FileText, DollarSign, TrendingDown, Wallet, BedDouble, Users, Package,
} from "lucide-react";
import { revertImport } from "@/lib/import.actions";

type Batch = {
  id: string;
  entityType: string;
  businessName: string | null;
  filename: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: string;
  note: string | null;
  createdByName: string;
  revertedByName: string | null;
  createdAt: string;
  revertedAt: string | null;
};

const ENTITY_LABEL: Record<string, { label: string; icon: any }> = {
  SALES:              { label: "Ventas",         icon: DollarSign },
  EXPENSES:           { label: "Gastos",         icon: TrendingDown },
  WITHDRAWALS:        { label: "Retiros",        icon: Wallet },
  HOTEL_RESERVATIONS: { label: "Reservaciones",  icon: BedDouble },
  GUESTS:             { label: "Huéspedes",      icon: Users },
  INVENTORY_ITEMS:    { label: "Inventario",     icon: Package },
  EMPLOYEES:          { label: "Empleados",      icon: Users },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  PROCESSING: { label: "Procesando", cls: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  COMPLETED:  { label: "Completado", cls: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle2 },
  FAILED:     { label: "Fallido",    cls: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
  REVERTED:   { label: "Revertido",  cls: "bg-gray-50 text-gray-600 border-gray-200",     icon: Undo2 },
};

export function HistoryClient({ batches: initial }: { batches: Batch[] }) {
  const [pending, start] = useTransition();
  const [batches, setBatches] = useState(initial);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleRevert(batchId: string) {
    start(async () => {
      try {
        const res = await revertImport(batchId);
        alert(`Revertido: ${res.deleted} registro(s) eliminados`);
        setBatches((prev) =>
          prev.map((b) =>
            b.id === batchId ? { ...b, status: "REVERTED", revertedAt: new Date().toISOString() } : b
          )
        );
        setConfirmingId(null);
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aún no has hecho importaciones.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((b) => {
        const entity = ENTITY_LABEL[b.entityType] ?? { label: b.entityType, icon: FileText };
        const EntityIcon = entity.icon;
        const status = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.COMPLETED;
        const StatusIcon = status.icon;
        const canRevert = b.status === "COMPLETED" && b.successRows > 0;

        return (
          <Card key={b.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <EntityIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{entity.label}</p>
                      {b.businessName && (
                        <Badge variant="secondary" className="text-[10px]">
                          {b.businessName}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${status.cls}`}>
                        <StatusIcon className="w-3 h-3 mr-0.5" />
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {b.filename} · por {b.createdByName}
                      {" · "}
                      {new Date(b.createdAt).toLocaleDateString("es-MX", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-muted-foreground">
                        Total: <span className="font-medium text-foreground">{b.totalRows}</span>
                      </span>
                      <span className="text-green-700">
                        ✓ {b.successRows}
                      </span>
                      {b.errorRows > 0 && (
                        <span className="text-red-600">✗ {b.errorRows}</span>
                      )}
                    </div>
                    {b.note && (
                      <p className="text-xs italic text-muted-foreground mt-1">{b.note}</p>
                    )}
                    {b.revertedByName && b.revertedAt && (
                      <p className="text-xs mt-1 text-red-600">
                        Revertido por {b.revertedByName} el{" "}
                        {new Date(b.revertedAt).toLocaleDateString("es-MX", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  {confirmingId === b.id ? (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        ¿Seguro?
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setConfirmingId(null)} disabled={pending}>
                        No
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRevert(b.id)} disabled={pending}>
                        Sí, revertir
                      </Button>
                    </div>
                  ) : canRevert ? (
                    <Button size="sm" variant="outline" onClick={() => setConfirmingId(b.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Deshacer
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Package, ArrowRight, Clock, CheckCircle2, XCircle, Truck, PackageOpen } from "lucide-react";
import Link from "next/link";
import type { RequisitionStatus } from "@prisma/client";

type RequisitionRow = {
  id: string;
  title: string;
  status: RequisitionStatus;
  note: string | null;
  neededBy: Date | null;
  createdAt: Date;
  businessName: string;
  itemsCount: number;
  estimatedTotalCents: number;
};

type Props = {
  requisitions: RequisitionRow[];
  newRequisitionHref: string;
  showBusinessName: boolean;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const STATUS_CONFIG: Record<
  RequisitionStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  DRAFT:     { label: "Borrador",  className: "bg-gray-100 text-gray-700 border-gray-200",     icon: Clock },
  SUBMITTED: { label: "Enviada",   className: "bg-blue-50 text-blue-700 border-blue-200",      icon: Clock },
  APPROVED:  { label: "Aprobada",  className: "bg-green-50 text-green-700 border-green-200",   icon: CheckCircle2 },
  REJECTED:  { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200",         icon: XCircle },
  ORDERED:   { label: "En compra", className: "bg-purple-50 text-purple-700 border-purple-200",icon: Truck },
  RECEIVED:  { label: "Recibida",  className: "bg-teal-50 text-teal-700 border-teal-200",      icon: PackageOpen },
  CLOSED:    { label: "Cerrada",   className: "bg-gray-50 text-gray-600 border-gray-200",      icon: CheckCircle2 },
};

export function RequisitionsList({ requisitions, newRequisitionHref, showBusinessName }: Props) {
  const byStatus: Record<string, RequisitionRow[]> = {
    active: requisitions.filter((r) =>
      ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED"].includes(r.status)
    ),
    completed: requisitions.filter((r) =>
      ["RECEIVED", "CLOSED"].includes(r.status)
    ),
    rejected: requisitions.filter((r) => r.status === "REJECTED"),
  };

  return (
    <div className="space-y-4">
      {/* Header acción */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {requisitions.length} requisiciones ·{" "}
          <span className="font-medium">{byStatus.active.length} activas</span>
        </p>
        <Button size="sm" asChild>
          <Link href={newRequisitionHref}>
            <Plus className="w-4 h-4 mr-1.5" /> Nueva requisición
          </Link>
        </Button>
      </div>

      {requisitions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Aún no has creado requisiciones.
            </p>
            <Button size="sm" asChild>
              <Link href={newRequisitionHref}>
                <Plus className="w-4 h-4 mr-1.5" /> Crear la primera
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Activas */}
          {byStatus.active.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Activas ({byStatus.active.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RequisitionRows rows={byStatus.active} showBusinessName={showBusinessName} />
              </CardContent>
            </Card>
          )}

          {/* Completadas */}
          {byStatus.completed.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Completadas ({byStatus.completed.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RequisitionRows rows={byStatus.completed.slice(0, 10)} showBusinessName={showBusinessName} />
              </CardContent>
            </Card>
          )}

          {/* Rechazadas */}
          {byStatus.rejected.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-700">
                  Rechazadas ({byStatus.rejected.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RequisitionRows rows={byStatus.rejected.slice(0, 10)} showBusinessName={showBusinessName} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function RequisitionRows({
  rows,
  showBusinessName,
}: {
  rows: RequisitionRow[];
  showBusinessName: boolean;
}) {
  return (
    <div className="divide-y">
      {rows.map((r) => {
        const cfg = STATUS_CONFIG[r.status];
        const StatusIcon = cfg.icon;
        return (
          <div key={r.id} className="px-4 py-3 hover:bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.itemsCount} producto(s)
                  {r.estimatedTotalCents > 0 && ` · Est. ${fmt(r.estimatedTotalCents)}`}
                  {showBusinessName && ` · ${r.businessName}`}
                  {" · "}
                  {new Date(r.createdAt).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}
                  {r.neededBy && (
                    <>
                      {" · Para "}
                      {new Date(r.neededBy).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </p>
                {r.note && (
                  <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                    {r.note}
                  </p>
                )}
              </div>
              <Badge variant="outline" className={`${cfg.className} text-[10px] shrink-0`}>
                <StatusIcon className="w-3 h-3 mr-0.5" />
                {cfg.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

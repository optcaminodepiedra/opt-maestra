import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, AlertCircle, Clock, CheckCircle2, Truck, PackageOpen,
  Sparkles, Home, Coffee, UtensilsCrossed, Calendar, User as UserIcon,
  AlertTriangle, ArrowRight,
} from "lucide-react";
import Link from "next/link";

type RequisitionRow = {
  id: string;
  title: string;
  status: string;
  kind: string;
  eventName: string | null;
  isPrivate: boolean;
  priority: string;
  urgentNote: string | null;
  requiresSeparatePayment: boolean;
  note: string | null;
  neededBy: string | null;
  createdAt: string;
  businessName: string;
  createdByName: string;
  itemsCount: number;
  estimatedTotalCents: number;
  hasPayable: boolean;
  payableStatus: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT:            { label: "Borrador",        cls: "bg-gray-100 text-gray-700 border-gray-200",   icon: Clock },
  SUBMITTED:        { label: "Por aprobar",     cls: "bg-blue-50 text-blue-700 border-blue-200",    icon: Clock },
  APPROVED:         { label: "Aprobada",        cls: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  REJECTED:         { label: "Rechazada",       cls: "bg-red-50 text-red-700 border-red-200",       icon: AlertCircle },
  ORDERED:          { label: "En compra",       cls: "bg-purple-50 text-purple-700 border-purple-200", icon: Truck },
  RECEIVED_PARTIAL: { label: "Entrega parcial", cls: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  RECEIVED:         { label: "Entregada",       cls: "bg-teal-50 text-teal-700 border-teal-200",    icon: PackageOpen },
  CLOSED:           { label: "Cerrada",         cls: "bg-gray-50 text-gray-600 border-gray-200",    icon: CheckCircle2 },
};

const KIND_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  RESTAURANT:      { label: "Restaurante",  icon: UtensilsCrossed, color: "text-blue-600" },
  SPECIAL_EVENT:   { label: "Especial",     icon: Sparkles,        color: "text-purple-600" },
  OWNER_HOUSE:     { label: "Casa NS",      icon: Home,            color: "text-amber-600" },
  VENDING_MACHINE: { label: "Dispensadora", icon: Coffee,          color: "text-green-600" },
  GENERAL:         { label: "General",      icon: Package,         color: "text-muted-foreground" },
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

type Props = {
  requisitions: RequisitionRow[];
  showKindIcon?: boolean;
};

export function RequisitionListPanel({ requisitions, showKindIcon = true }: Props) {
  if (requisitions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sin requisiciones en esta categoría.</p>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por estado funcional
  const groups = {
    pendientes: requisitions.filter((r) => ["SUBMITTED", "APPROVED", "ORDERED"].includes(r.status)),
    parciales: requisitions.filter((r) => r.status === "RECEIVED_PARTIAL"),
    entregadas: requisitions.filter((r) => r.status === "RECEIVED"),
    cerradas: requisitions.filter((r) => r.status === "CLOSED"),
    rechazadas: requisitions.filter((r) => r.status === "REJECTED"),
  };

  return (
    <div className="space-y-4">
      {groups.pendientes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Activas ({groups.pendientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RequisitionRows rows={groups.pendientes} showKindIcon={showKindIcon} />
          </CardContent>
        </Card>
      )}

      {groups.parciales.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Entregas parciales ({groups.parciales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RequisitionRows rows={groups.parciales} showKindIcon={showKindIcon} />
          </CardContent>
        </Card>
      )}

      {groups.entregadas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PackageOpen className="w-4 h-4 text-teal-600" />
              Entregadas (esperan firma) ({groups.entregadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RequisitionRows rows={groups.entregadas} showKindIcon={showKindIcon} />
          </CardContent>
        </Card>
      )}

      {groups.cerradas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Cerradas ({groups.cerradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RequisitionRows rows={groups.cerradas.slice(0, 10)} showKindIcon={showKindIcon} compact />
          </CardContent>
        </Card>
      )}

      {groups.rechazadas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700">
              Rechazadas ({groups.rechazadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RequisitionRows rows={groups.rechazadas.slice(0, 10)} showKindIcon={showKindIcon} compact />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequisitionRows({
  rows,
  showKindIcon,
  compact,
}: {
  rows: RequisitionRow[];
  showKindIcon: boolean;
  compact?: boolean;
}) {
  return (
    <div className="divide-y">
      {rows.map((r) => {
        const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.DRAFT;
        const StatusIcon = cfg.icon;
        const kindCfg = KIND_CONFIG[r.kind] ?? KIND_CONFIG.GENERAL;
        const KindIcon = kindCfg.icon;
        const isUrgent = r.priority === "URGENT";

        return (
          <Link
            key={r.id}
            href={`/app/inventory/requisitions/${r.id}`}
            className="block px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {isUrgent && (
                    <Badge variant="destructive" className="text-[9px]">
                      🚨 URGENTE
                    </Badge>
                  )}
                  {showKindIcon && (
                    <Badge variant="outline" className={`text-[10px] ${kindCfg.color} border-current/20`}>
                      <KindIcon className="w-3 h-3 mr-0.5" />
                      {kindCfg.label}
                    </Badge>
                  )}
                  {r.isPrivate && (
                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                      🔒 Privada
                    </Badge>
                  )}
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  {r.eventName && (
                    <span className="text-xs text-purple-700 font-medium">· {r.eventName}</span>
                  )}
                </div>

                {!compact && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <UserIcon className="w-3 h-3 inline mr-1" />
                    {r.createdByName} · {r.businessName}
                    {" · "}
                    <Calendar className="w-3 h-3 inline mx-1" />
                    {new Date(r.createdAt).toLocaleDateString("es-MX", {
                      day: "numeric", month: "short",
                    })}
                    {r.neededBy && (
                      <>
                        {" · Para "}
                        <span className="font-medium">
                          {new Date(r.neededBy).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                      </>
                    )}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {r.itemsCount} producto(s)
                    {r.estimatedTotalCents > 0 && ` · Est. ${fmt(r.estimatedTotalCents)}`}
                  </span>
                  {r.requiresSeparatePayment && (
                    <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                      💳 Pago aparte
                    </Badge>
                  )}
                  {r.hasPayable && r.payableStatus === "PAID" && (
                    <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                      ✓ Pagado
                    </Badge>
                  )}
                  {r.hasPayable && r.payableStatus === "PENDING" && (
                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                      ⏳ Por pagar
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
                  <StatusIcon className="w-3 h-3 mr-0.5" />
                  {cfg.label}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

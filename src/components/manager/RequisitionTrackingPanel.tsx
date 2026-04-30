import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, Plus, Clock, CheckCircle2, XCircle, AlertCircle,
  PackageCheck, PackageX, ArrowRight, ShoppingCart, Sparkles,
} from "lucide-react";

type Req = {
  id: string;
  title: string;
  kind: string;
  eventName: string | null;
  status: string;
  priority: string;
  itemCount: number;
  createdAt: string;
};

type Props = {
  requisitions: Req[];
  primaryBusinessId: string;
  managerBasePath: string; // "/app/manager/ops" | "/app/manager/restaurant" | "/app/manager/ranch"
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT:            { label: "Borrador",     cls: "bg-gray-50 text-gray-600 border-gray-200",     icon: Clock },
  SUBMITTED:        { label: "Enviada",      cls: "bg-blue-50 text-blue-700 border-blue-200",     icon: Clock },
  APPROVED:         { label: "Aprobada",     cls: "bg-cyan-50 text-cyan-700 border-cyan-200",     icon: CheckCircle2 },
  REJECTED:         { label: "Rechazada",    cls: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
  ORDERED:          { label: "En compra",    cls: "bg-purple-50 text-purple-700 border-purple-200", icon: ShoppingCart },
  RECEIVED_PARTIAL: { label: "Parcial",      cls: "bg-amber-50 text-amber-700 border-amber-200",  icon: AlertCircle },
  RECEIVED:         { label: "Recibida",     cls: "bg-green-50 text-green-700 border-green-200",  icon: PackageCheck },
  CLOSED:           { label: "Cerrada",      cls: "bg-gray-50 text-gray-500 border-gray-200",     icon: CheckCircle2 },
};

const KIND_CONFIG: Record<string, { label: string; emoji: string }> = {
  RESTAURANT:      { label: "Restaurante",   emoji: "🍽️" },
  SPECIAL_EVENT:   { label: "Evento",         emoji: "✨" },
  OWNER_HOUSE:     { label: "Casa Navarro",  emoji: "🏠" },
  VENDING_MACHINE: { label: "Dispensadora",  emoji: "🥤" },
  GENERAL:         { label: "General",        emoji: "📦" },
};

export function RequisitionTrackingPanel({ requisitions, primaryBusinessId, managerBasePath }: Props) {
  const active = requisitions.filter((r) =>
    ["SUBMITTED", "APPROVED", "ORDERED", "RECEIVED_PARTIAL"].includes(r.status)
  );
  const recent = requisitions.filter((r) =>
    ["RECEIVED", "CLOSED", "REJECTED"].includes(r.status)
  ).slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" /> Mis requisiciones
          {active.length > 0 && (
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              {active.length} activas
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" asChild>
            <Link href={`${managerBasePath}/requisitions`}>
              Ver todas
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/app/inventory/requisitions/new?businessId=${primaryBusinessId}`}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nueva
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {requisitions.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No tienes requisiciones aún
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/app/inventory/requisitions/new?businessId=${primaryBusinessId}`}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Crear primera requisición
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* En proceso */}
            {active.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                  En proceso
                </p>
                <div className="space-y-1.5">
                  {active.map((r) => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.SUBMITTED;
                    const StatusIcon = cfg.icon;
                    const kindCfg = KIND_CONFIG[r.kind] ?? KIND_CONFIG.GENERAL;
                    return (
                      <Link
                        key={r.id}
                        href={`/app/inventory/requisitions/${r.id}`}
                        className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors group"
                      >
                        <span className="text-base shrink-0">{kindCfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{r.title}</p>
                            {r.priority === "URGENT" && (
                              <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200 shrink-0">
                                URGENTE
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {kindCfg.label}
                            {r.eventName && ` · ${r.eventName}`}
                            {" · "}{r.itemCount} ítem(s)
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.cls}`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                          {cfg.label}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recientes cerradas */}
            {recent.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
                  Historial reciente
                </p>
                <div className="space-y-1">
                  {recent.map((r) => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.RECEIVED;
                    const StatusIcon = cfg.icon;
                    const kindCfg = KIND_CONFIG[r.kind] ?? KIND_CONFIG.GENERAL;
                    return (
                      <Link
                        key={r.id}
                        href={`/app/inventory/requisitions/${r.id}`}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 transition-colors text-xs opacity-70 hover:opacity-100"
                      >
                        <span className="shrink-0">{kindCfg.emoji}</span>
                        <span className="flex-1 truncate">{r.title}</span>
                        <Badge variant="outline" className={`text-[9px] shrink-0 ${cfg.cls}`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                          {cfg.label}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

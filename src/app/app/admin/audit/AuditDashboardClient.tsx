"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, Download, RefreshCw, Users, Activity,
  AlertTriangle, AlertOctagon, Search, X,
} from "lucide-react";
import Link from "next/link";

import HeatmapCard from "@/components/audit/HeatmapCard";
import UserActivityCard from "@/components/audit/UserActivityCard";
import EventsTimeline from "@/components/audit/EventsTimeline";
import AlertsCard from "@/components/audit/AlertsCard";
import AuditFilters from "@/components/audit/AuditFilters";

import { ACTION_CATEGORIES, ACTION_LABELS } from "@/lib/audit-actions";

interface Props {
  filters: any;
  businesses: Array<{ id: string; name: string }>;
  kpis: { totalActions: number; activeUsers: number; criticalCount: number; highCount: number };
  heatmap: Array<{ userId: string | null; userName: string; hour: number; count: number }>;
  userSummary: Array<{ userId: string | null; userName: string; userRole: string | null; totalActions: number; criticalCount: number; highCount: number }>;
  events: Array<any>;
  alerts: Array<{ severity: "info" | "warning" | "danger"; title: string; detail: string; userId?: string }>;
  auditUsers: Array<{ id: string; name: string; count: number }>;
  actionStats: Array<{ action: string; count: number }>;
}

const fmt = (n: number) => new Intl.NumberFormat("es-MX").format(n);

export default function AuditDashboardClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();

  function setParam(key: string, value: string | null) {
    const newSp = new URLSearchParams(sp);
    if (value === null || value === "" || value === "all") {
      newSp.delete(key);
    } else {
      newSp.set(key, value);
    }
    router.push(`/app/admin/audit?${newSp.toString()}`);
  }

  function clearFilters() {
    router.push("/app/admin/audit");
  }

  function handleExport() {
    const exportSp = new URLSearchParams(sp);
    window.location.href = `/api/audit/export?${exportSp.toString()}`;
  }

  const hasActiveFilters =
    !!props.filters.userId ||
    !!props.filters.businessId ||
    !!props.filters.severity ||
    !!props.filters.action ||
    !!props.filters.category ||
    !!props.filters.search;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-indigo-600" />
            Historial de movimientos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro completo de actividad por usuario · sólo MASTER_ADMIN, OWNER, SUPERIOR
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <AuditFilters
        filters={props.filters}
        businesses={props.businesses}
        auditUsers={props.auditUsers}
        actionStats={props.actionStats}
        onChange={setParam}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Acciones</span>
              <Activity className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{fmt(props.kpis.totalActions)}</div>
            <p className="text-[10px] text-muted-foreground">en el periodo</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Usuarios</span>
              <Users className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">{fmt(props.kpis.activeUsers)}</div>
            <p className="text-[10px] text-muted-foreground">activos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Acciones altas</span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700">{fmt(props.kpis.highCount)}</div>
            <p className="text-[10px] text-muted-foreground">deletes, cancelaciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">Críticas</span>
              <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-700">{fmt(props.kpis.criticalCount)}</div>
            <p className="text-[10px] text-muted-foreground">cambios sensibles</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {props.alerts.length > 0 && <AlertsCard alerts={props.alerts} />}

      {/* Heatmap */}
      {props.heatmap.length > 0 && <HeatmapCard heatmap={props.heatmap} />}

      {/* Cards por usuario */}
      {props.userSummary.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Actividad por usuario
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {props.userSummary.map((u) => (
              <UserActivityCard
                key={u.userId ?? "anon"}
                user={u}
                fromIso={props.filters.fromIso}
                toIso={props.filters.toIso}
              />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {props.events.length > 0 ? (
        <EventsTimeline events={props.events} businesses={props.businesses} />
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No hay eventos registrados con los filtros actuales.
            {hasActiveFilters && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="w-3 h-3 mr-1" /> Limpiar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

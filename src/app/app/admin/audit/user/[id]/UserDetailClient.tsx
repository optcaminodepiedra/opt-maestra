"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Activity, AlertOctagon, Building2, Mail } from "lucide-react";
import EventsTimeline from "@/components/audit/EventsTimeline";
import { ACTION_LABELS, ACTION_CATEGORIES } from "@/lib/audit-actions";

interface Props {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    email: string | null;
    isActive: boolean;
    createdAt: string;
  };
  filters: any;
  detail: {
    events: any[];
    byAction: Array<{ action: string; count: number }>;
    byBusiness: Array<{ businessId: string | null; count: number }>;
  };
  businessMap: Record<string, string>;
}

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "last7days", label: "7 días" },
  { key: "last30days", label: "30 días" },
  { key: "thismonth", label: "Este mes" },
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function UserDetailClient({ user, filters, detail, businessMap }: Props) {
  const router = useRouter();
  const businesses = Object.entries(businessMap).map(([id, name]) => ({ id, name: name as string }));

  function setPreset(preset: string) {
    router.push(`/app/admin/audit/user/${user.id}?preset=${preset}`);
  }

  // Calcular categorías
  const categoryStats: Record<string, number> = {};
  for (const { action, count } of detail.byAction) {
    let cat = "Otros";
    for (const [k, acts] of Object.entries(ACTION_CATEGORIES)) {
      if (acts.includes(action)) {
        cat = k;
        break;
      }
    }
    categoryStats[cat] = (categoryStats[cat] ?? 0) + count;
  }

  const totalActions = detail.events.length;

  return (
    <div className="space-y-4">
      {/* Header con info del usuario */}
      <Card>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
            {initials(user.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold">{user.fullName}</h1>
              {!user.isActive && (
                <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                  Inactivo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> @{user.username}
              </span>
              <span className="font-medium">{user.role}</span>
              {user.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {user.email}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presets de fechas */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Periodo:</span>
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={filters.preset === p.key ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(p.key)}
            className="h-7 text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Total acciones</div>
            <div className="text-2xl font-bold">{totalActions}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Categorías</div>
            <div className="text-2xl font-bold">{Object.keys(categoryStats).length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Negocios tocados</div>
            <div className="text-2xl font-bold">{detail.byBusiness.filter(b => b.businessId).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por categoría y por acción */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {Object.entries(categoryStats)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([cat, count]) => {
                const pct = totalActions > 0 ? ((count as number) / totalActions) * 100 : 0;
                return (
                  <div key={cat} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>{cat}</span>
                      <span className="text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Por negocio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {detail.byBusiness
              .filter(b => b.businessId)
              .slice(0, 6)
              .map((b) => {
                const pct = totalActions > 0 ? (b.count / totalActions) * 100 : 0;
                return (
                  <div key={b.businessId} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{businessMap[b.businessId!] ?? b.businessId}</span>
                      <span className="text-muted-foreground">{b.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {detail.byBusiness.filter(b => !b.businessId).length > 0 && (
              <p className="text-[10px] text-muted-foreground italic mt-2">
                + {detail.byBusiness.find(b => !b.businessId)?.count} acciones sin negocio
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <EventsTimeline
        events={detail.events.map((e) => ({
          ...e,
          userId: user.id,
          userName: user.fullName,
          userRole: user.role,
        }))}
        businesses={businesses}
      />
    </div>
  );
}

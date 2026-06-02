import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

import AuditDashboardClient from "./AuditDashboardClient";
import {
  getAuditKpis,
  getAuditHeatmap,
  getUserActivitySummary,
  getRecentAuditEvents,
  getAuditAlerts,
  getAuditUsers,
  getAuditActionStats,
} from "@/lib/audit-queries";
import { ACTION_CATEGORIES } from "@/lib/audit-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

function resolveFiltersFromUrl(sp: Record<string, string | undefined>) {
  const preset = sp.preset ?? "today";
  const now = new Date();
  let from: Date, to: Date;

  switch (preset) {
    case "today": {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "yesterday": {
      from = new Date(now);
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "last7days": {
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "last30days": {
      from = new Date(now);
      from.setDate(now.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "thismonth": {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "custom": {
      from = sp.from ? new Date(sp.from + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
      to = sp.to ? new Date(sp.to + "T23:59:59") : new Date(now);
      break;
    }
    default: {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      to = new Date(now);
      to.setHours(23, 59, 59, 999);
    }
  }

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    preset,
    userId: sp.userId || null,
    businessId: sp.businessId || null,
    severity: sp.severity || null,
    action: sp.action || null,
    category: sp.category || null,
    search: sp.search || null,
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Acceso restringido
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            El historial de movimientos sólo está disponible para
            MASTER_ADMIN, OWNER y SUPERIOR.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const filters = resolveFiltersFromUrl(sp);

  // Filtros por categoría → expandir a lista de actions
  const actionsInCategory =
    filters.category && ACTION_CATEGORIES[filters.category]
      ? ACTION_CATEGORIES[filters.category]
      : undefined;

  // Cargar todos los datos en paralelo
  const [
    businesses,
    kpis,
    heatmap,
    userSummary,
    events,
    alerts,
    auditUsers,
    actionStats,
  ] = await Promise.all([
    prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAuditKpis(filters, actionsInCategory),
    getAuditHeatmap(filters, actionsInCategory),
    getUserActivitySummary(filters, actionsInCategory),
    getRecentAuditEvents(filters, 80, actionsInCategory),
    getAuditAlerts(filters),
    getAuditUsers(filters),
    getAuditActionStats(filters),
  ]);

  return (
    <AuditDashboardClient
      filters={filters}
      businesses={businesses}
      kpis={kpis}
      heatmap={heatmap}
      userSummary={userSummary}
      events={events}
      alerts={alerts}
      auditUsers={auditUsers}
      actionStats={actionStats}
    />
  );
}

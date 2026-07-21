import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cable, ShieldAlert } from "lucide-react";
import { IntegrationsClient } from "@/components/admin/IntegrationsClient";

const db = prisma as any;

export const dynamic = "force-dynamic";

const DIRECTION_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role ?? "";
  if (!DIRECTION_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" /> Sin acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo dirección puede configurar conexiones externas.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [businesses, connectors] = await Promise.all([
    db.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.integrationConnector.findMany({
      include: {
        business: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            recordsRead: true,
            recordsInserted: true,
            recordsUpdated: true,
            recordsSkipped: true,
            recordsFailed: true,
            errorSummary: true,
          },
        },
      },
      orderBy: [{ business: { name: "asc" } }, { createdAt: "desc" }],
    }),
  ]);

  const serialized = connectors.map((connector: any) => ({
    id: connector.id,
    businessId: connector.businessId,
    businessName: connector.business.name,
    name: connector.name,
    source: connector.source,
    status: connector.status,
    isActive: connector.isActive,
    agentTokenPrefix: connector.agentTokenPrefix,
    config: (connector.config ?? {}) as Record<string, unknown>,
    lastSeenAt: connector.lastSeenAt?.toISOString() ?? null,
    lastSyncAt: connector.lastSyncAt?.toISOString() ?? null,
    lastSuccessAt: connector.lastSuccessAt?.toISOString() ?? null,
    lastError: connector.lastError,
    createdByName: connector.createdBy?.fullName ?? null,
    createdAt: connector.createdAt.toISOString(),
    lastRun: connector.runs[0]
      ? {
          ...connector.runs[0],
          startedAt: connector.runs[0].startedAt.toISOString(),
          finishedAt: connector.runs[0].finishedAt?.toISOString() ?? null,
        }
      : null,
  }));

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Cable className="w-7 h-7 text-blue-500" />
          Centro de integraciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecta las computadoras de SoftRestaurant y las hojas de reservaciones de los hoteles.
        </p>
      </div>

      <IntegrationsClient businesses={businesses} connectors={serialized as any} />
    </div>
  );
}

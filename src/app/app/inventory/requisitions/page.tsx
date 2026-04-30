import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, Plus, AlertTriangle, TrendingDown, Boxes,
  ClipboardList, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { RequisitionTabs } from "@/components/inventory/RequisitionTabs";
import { RequisitionListPanel } from "@/components/inventory/RequisitionListPanel";
import { listRequisitions } from "@/lib/requisitions.queries";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING", "INVENTORY",
  "MANAGER_OPS", "MANAGER", "MANAGER_HOTEL",
];

const PRIVATE_VIEWERS = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY"];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sin permisos para ver el almacén general.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const filterKind = sp.kind;
  const showOwnerHouse = PRIVATE_VIEWERS.includes(role);

  // Cargar todas las requisiciones aplicables al usuario
  const allReqs = await listRequisitions({});

  // Conteos por tipo
  const counts = {
    RESTAURANT: allReqs.filter((r) => r.kind === "RESTAURANT").length,
    SPECIAL_EVENT: allReqs.filter((r) => r.kind === "SPECIAL_EVENT").length,
    OWNER_HOUSE: allReqs.filter((r) => r.kind === "OWNER_HOUSE").length,
    VENDING_MACHINE: allReqs.filter((r) => r.kind === "VENDING_MACHINE").length,
    GENERAL: allReqs.filter((r) => r.kind === "GENERAL").length,
  };

  // Filtrar según tab activo
  const filteredReqs = filterKind
    ? allReqs.filter((r) => r.kind === filterKind)
    : allReqs;

  // Stock crítico global
  const lowStockCount = await prisma.inventoryItem.count({
    where: {
      isActive: true,
      onHandQty: { lte: 0 }, // simplificado: lo que está en 0 o menos
    },
  });

  // KPIs
  const [totalItems, businessCount, urgentRequisitions] = await Promise.all([
    prisma.inventoryItem.count({ where: { isActive: true } }),
    prisma.business.count(),
    prisma.requisition.count({
      where: {
        priority: "URGENT",
        status: { in: ["SUBMITTED", "APPROVED", "ORDERED"] },
        ...(showOwnerHouse ? {} : { isPrivate: false }),
      },
    }),
  ]);

  // Serializar
  const serializedReqs = filteredReqs.map((r: any) => {
    const totalEst = r.items.reduce(
      (sum: number, it: any) => sum + it.qtyRequested * it.estimatedPriceCents,
      0
    );
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      kind: r.kind,
      eventName: r.eventName,
      isPrivate: r.isPrivate,
      priority: r.priority,
      urgentNote: r.urgentNote,
      requiresSeparatePayment: r.requiresSeparatePayment,
      note: r.note,
      neededBy: r.neededBy?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      businessName: r.business?.name ?? "—",
      createdByName: r.createdBy?.fullName ?? "—",
      itemsCount: r.items.length,
      estimatedTotalCents: totalEst,
      hasPayable: !!r.accountsPayable,
      payableStatus: r.accountsPayable?.status ?? null,
    };
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-blue-500" />
            Almacén general
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de stock y requisiciones de todos los negocios
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/inventory/items">
              <Package className="w-4 h-4 mr-1.5" /> Catálogo
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/inventory/requisitions/new">
              <Plus className="w-4 h-4 mr-1.5" /> Nueva requisición
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          color="blue"
          icon={<Boxes className="h-3.5 w-3.5 text-blue-500" />}
          label="Productos"
          value={totalItems.toString()}
          subtitle={`${businessCount} negocios`}
        />
        <KpiCard
          color="amber"
          icon={<ClipboardList className="h-3.5 w-3.5 text-amber-500" />}
          label="Requisiciones"
          value={(counts.RESTAURANT + counts.SPECIAL_EVENT + counts.OWNER_HOUSE + counts.VENDING_MACHINE + counts.GENERAL).toString()}
          subtitle={`${counts.SPECIAL_EVENT} especiales`}
        />
        <KpiCard
          color={urgentRequisitions > 0 ? "red" : "green"}
          icon={<AlertTriangle className={`h-3.5 w-3.5 ${urgentRequisitions > 0 ? "text-red-500" : "text-green-500"}`} />}
          label="Urgentes"
          value={urgentRequisitions.toString()}
          subtitle={urgentRequisitions === 0 ? "Sin urgencias" : "Por atender"}
        />
        <KpiCard
          color={lowStockCount > 0 ? "red" : "green"}
          icon={<TrendingDown className={`h-3.5 w-3.5 ${lowStockCount > 0 ? "text-red-500" : "text-green-500"}`} />}
          label="Stock crítico"
          value={lowStockCount.toString()}
          subtitle={lowStockCount === 0 ? "Stock óptimo" : "Sin existencia"}
        />
      </div>

      {/* Tabs */}
      <RequisitionTabs
        activeTab={filterKind ?? "all"}
        counts={counts}
        showOwnerHouse={showOwnerHouse}
      />

      {/* Lista filtrada */}
      <RequisitionListPanel requisitions={serializedReqs} showKindIcon={!filterKind} />
    </div>
  );
}

function KpiCard({
  color, icon, label, value, subtitle,
}: {
  color: string; icon: React.ReactNode; label: string; value: string; subtitle: string;
}) {
  return (
    <Card className={`border-l-4 border-l-${color}-500 py-0`}>
      <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

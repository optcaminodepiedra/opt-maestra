import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerInventory } from "@/lib/manager-data";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { InventoryList } from "@/components/manager/InventoryList";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManagerOpsInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("ops");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const items = await loadManagerInventory(scope, selectedBusinessId);
  const newHref = `/app/manager/ops/requisitions/new${
    selectedBusinessId ? `?businessId=${selectedBusinessId}` : scope.businesses.length === 1 ? `?businessId=${scope.businesses[0].id}` : ""
  }`;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Inventario"
        subtitle="Stock de productos de tus negocios"
        icon={<Package className="w-7 h-7 text-blue-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/ops/inventory"
      />
      <InventoryList
        items={items}
        showBusinessColumn={!selectedBusinessId && scope.businesses.length > 1}
        newRequisitionHref={newHref}
      />
    </div>
  );
}

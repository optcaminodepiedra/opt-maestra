import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerInventory } from "@/lib/manager-data";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { InventoryList } from "@/components/manager/InventoryList";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManagerRestaurantInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("restaurant");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const items = await loadManagerInventory(scope, selectedBusinessId);
  const defaultBiz = scope.businesses[0]?.id;
  const newHref = `/app/manager/restaurant/requisitions/new${
    selectedBusinessId ? `?businessId=${selectedBusinessId}` : defaultBiz ? `?businessId=${defaultBiz}` : ""
  }`;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Inventario"
        subtitle="Stock de productos de tu restaurante"
        icon={<Package className="w-7 h-7 text-blue-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/restaurant/inventory"
      />
      <InventoryList
        items={items}
        showBusinessColumn={!selectedBusinessId && scope.businesses.length > 1}
        newRequisitionHref={newHref}
      />
    </div>
  );
}

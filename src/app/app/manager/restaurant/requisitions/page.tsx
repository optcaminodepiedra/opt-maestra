import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerRequisitions } from "@/lib/manager-data";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { RequisitionsList } from "@/components/manager/RequisitionsList";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ManagerRestaurantRequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("restaurant");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const requisitions = await loadManagerRequisitions(scope, selectedBusinessId);
  const defaultBiz = scope.businesses[0]?.id;
  const newHref = `/app/manager/restaurant/requisitions/new${
    selectedBusinessId ? `?businessId=${selectedBusinessId}` : defaultBiz ? `?businessId=${defaultBiz}` : ""
  }`;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Mis requisiciones"
        subtitle="Pedidos al almacén que has creado"
        icon={<Package className="w-7 h-7 text-purple-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/restaurant/requisitions"
      />
      <RequisitionsList
        requisitions={requisitions}
        newRequisitionHref={newHref}
        showBusinessName={!selectedBusinessId && scope.businesses.length > 1}
      />
    </div>
  );
}

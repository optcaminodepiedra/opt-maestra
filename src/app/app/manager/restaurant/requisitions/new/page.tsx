import { redirect } from "next/navigation";
import { resolveManagerScope } from "@/lib/manager-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import Link from "next/link";
import { NewRequisitionClient } from "@/components/inventory/NewRequisitionClient";
import { getInventoryItemsForBusiness } from "@/lib/requisitions.actions";

export const dynamic = "force-dynamic";

export default async function NewRequisitionRestaurantPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("restaurant");
  const sp = await searchParams;

  if (scope.businesses.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin negocios asignados</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne un negocio.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedBusinessId = sp.businessId ?? scope.businesses[0].id;
  if (!scope.businessIds.includes(selectedBusinessId)) {
    redirect(`/app/manager/restaurant/requisitions/new?businessId=${scope.businesses[0].id}`);
  }

  const items = await getInventoryItemsForBusiness(selectedBusinessId);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/manager/restaurant/requisitions">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-7 h-7 text-blue-500" /> Nueva requisición
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Solicita productos al almacén general
        </p>
      </div>

      <NewRequisitionClient
        businesses={scope.businesses.map((b) => ({ id: b.id, name: b.name }))}
        selectedBusinessId={selectedBusinessId}
        items={items}
      />
    </div>
  );
}

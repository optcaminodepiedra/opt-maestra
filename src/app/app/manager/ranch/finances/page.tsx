import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerFinances } from "@/lib/manager-data";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { FinancesPanel } from "@/components/manager/FinancesPanel";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagerFinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("ranch");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const data = await loadManagerFinances(scope, selectedBusinessId);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Finanzas"
        subtitle="Ventas, gastos y retiros de tus negocios"
        icon={<DollarSign className="w-7 h-7 text-green-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/ranch/finances"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/manager/ranch/reports">Reportes</Link>
        </Button>
      </ManagerSectionHeader>

      <FinancesPanel
        salesToday={data.salesToday}
        salesMonthTotalCents={data.salesMonthTotalCents}
        salesTodayByMethod={data.salesTodayByMethod}
        expensesRecent={data.expensesRecent}
        expensesMonthTotalCents={data.expensesMonthTotalCents}
        withdrawalsRecent={data.withdrawalsRecent}
        withdrawalsPettyTodayCents={data.withdrawalsPettyTodayCents}
        withdrawalsLargePendingCount={data.withdrawalsLargePendingCount}
        showBusinessName={!selectedBusinessId && scope.businesses.length > 1}
      />
    </div>
  );
}

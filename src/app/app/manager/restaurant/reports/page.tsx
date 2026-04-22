import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerReports } from "@/lib/manager-reports";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { ReportsPanel } from "@/components/manager/ReportsPanel";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default async function ManagerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; y?: string; m?: string }>;
}) {
  const scope = await resolveManagerScope("restaurant");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const now = new Date();
  const year = parseInt(sp.y ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.m ?? String(now.getMonth() + 1), 10);

  const data = await loadManagerReports(scope, year, month, selectedBusinessId);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const bizQuery = selectedBusinessId ? `&businessId=${selectedBusinessId}` : "";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Reportes"
        subtitle="Resumen financiero mensual"
        icon={<FileText className="w-7 h-7 text-indigo-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/restaurant/reports"
      />

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/manager/restaurant/reports?y=${prev.y}&m=${prev.m}${bizQuery}`}>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="text-sm font-medium min-w-[160px] text-center">
          {MONTHS[month - 1]} {year}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/manager/restaurant/reports?y=${next.y}&m=${next.m}${bizQuery}`}>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <ReportsPanel
        year={year}
        month={month}
        monthly={data.monthly}
        daily={data.daily}
        showBusinessColumn={!selectedBusinessId && scope.businesses.length > 1}
      />
    </div>
  );
}

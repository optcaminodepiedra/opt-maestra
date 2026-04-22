import { resolveManagerScope } from "@/lib/manager-scope";
import { loadManagerPayroll } from "@/lib/manager-data";
import { ManagerSectionHeader } from "@/components/manager/ManagerSectionHeader";
import { TeamPayrollPanel } from "@/components/manager/TeamPayrollPanel";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManagerPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const scope = await resolveManagerScope("ranch");
  const sp = await searchParams;
  const selectedBusinessId = sp.businessId ?? null;

  const data = await loadManagerPayroll(scope, selectedBusinessId);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <ManagerSectionHeader
        title="Asistencias del equipo"
        subtitle="Quién trabaja hoy y quién falta"
        icon={<Users className="w-7 h-7 text-purple-500" />}
        businesses={scope.businesses}
        selectedBusinessId={selectedBusinessId}
        sectionBaseHref="/app/manager/ranch/payroll"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/manager/ranch/schedule">Programar turnos</Link>
        </Button>
      </ManagerSectionHeader>

      <TeamPayrollPanel
        team={data.team}
        workDays={data.workDays}
        scheduledShifts={data.scheduledShifts}
        showBusinessName={!selectedBusinessId && scope.businesses.length > 1}
      />
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getReportsOverview, type ReportsRangeKey } from "@/lib/reports.actions";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function OwnerReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: ReportsRangeKey; businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const sp = (await searchParams) ?? {};
  const range = (sp.range ?? "30d") as ReportsRangeKey;
  const businessId = sp.businessId ?? null;

  const data = await getReportsOverview({ range, businessId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Consolidado visual por rango y unidad (ventas, gastos, retiros, neto).
        </p>
      </div>

      <ReportsClient initial={data} />
    </div>
  );
}

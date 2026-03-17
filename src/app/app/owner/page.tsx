import { getOwnerExecutiveDashboard } from "@/lib/dashboard.actions";
import { OwnerExecutiveDashboard } from "@/components/dashboard/OwnerExecutiveDashboard";
import { RangePicker } from "@/components/app/RangePicker";

type RangeKey = "today" | "yesterday" | "7d" | "month";

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams?: Promise<{ range?: RangeKey }>;
}) {
  const sp = (await searchParams) ?? {};
  const range = (sp.range ?? "today") as RangeKey;

  const data = await getOwnerExecutiveDashboard(range);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Ejecutivo</h1>
          <p className="text-sm text-muted-foreground">
            Central de mando: finanzas, alertas, operación y apps.
          </p>
        </div>

        <RangePicker />
      </div>

      <OwnerExecutiveDashboard data={data} />
    </div>
  );
}

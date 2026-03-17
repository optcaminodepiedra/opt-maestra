import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskProgressSummary } from "@/lib/tasks.metrics";

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        {value}
        {hint ? (
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ProgressSummary({
  title,
  data,
}: {
  title: string;
  data: TaskProgressSummary;
}) {
  const total = data.totals.ALL;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="text-xl font-semibold">Resumen de avance</div>
        </div>
        <Badge variant="secondary">{total} en total</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Por hacer" value={data.totals.TODO} hint={pct(data.totals.TODO, total)} />
        <StatCard title="En progreso" value={data.totals.DOING} hint={pct(data.totals.DOING, total)} />
        <StatCard title="Bloqueado" value={data.totals.BLOCKED} hint={pct(data.totals.BLOCKED, total)} />
        <StatCard title="Hecho" value={data.totals.DONE} hint={pct(data.totals.DONE, total)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Por unidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byBusiness.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin datos</div>
            ) : (
              data.byBusiness.slice(0, 12).map((b) => (
                <div key={b.businessId ?? "none"} className="flex items-center justify-between">
                  <div className="text-sm font-medium">{b.businessName}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {b.totals.DONE}/{b.totals.ALL}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Por responsable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byAssigned.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sin datos</div>
            ) : (
              data.byAssigned.slice(0, 12).map((u) => (
                <div key={u.userId ?? "none"} className="flex items-center justify-between">
                  <div className="text-sm font-medium">{u.userName}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {u.totals.DONE}/{u.totals.ALL}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

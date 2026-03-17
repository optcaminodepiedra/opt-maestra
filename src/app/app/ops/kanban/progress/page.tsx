import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProgressPage() {
  const byStatus = await prisma.task.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { status: "asc" },
  });

  const total = byStatus.reduce((s, x) => s + x._count._all, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kanban · Avance</h1>
          <p className="text-sm text-muted-foreground">Resumen por estatus</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{total} total</Badge>
          <Link className="text-sm underline" href="/app/ops/kanban/activities">Actividades</Link>
          <Link className="text-sm underline" href="/app/ops/kanban/tickets">Tickets</Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Conteo por estatus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {byStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay tareas aún.</div>
          ) : (
            byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between rounded-lg border p-3">
                <div className="font-medium">{s.status}</div>
                <Badge variant="secondary">{s._count._all}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

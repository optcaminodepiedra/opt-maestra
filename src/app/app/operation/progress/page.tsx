import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const rows = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      assignedTasks: {
        select: { status: true },
      },
    },
  });

  const data = rows.map((u) => {
    const total = u.assignedTasks.length;
    const done = u.assignedTasks.filter((t) => t.status === "DONE").length;
    const doing = u.assignedTasks.filter((t) => t.status === "DOING").length;
    const blocked = u.assignedTasks.filter((t) => t.status === "BLOCKED").length;
    const todo = u.assignedTasks.filter((t) => t.status === "TODO").length;
    return { name: u.fullName, total, done, doing, blocked, todo };
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-muted-foreground">Operación</div>
        <h1 className="text-2xl font-semibold tracking-tight">Avance</h1>
        <div className="text-sm text-muted-foreground mt-1">
          Resumen por persona (asignadas).
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {data.map((r) => (
          <Card key={r.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{r.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total: {r.total}</Badge>
              <Badge variant="secondary">Todo: {r.todo}</Badge>
              <Badge variant="secondary">Doing: {r.doing}</Badge>
              <Badge variant="destructive">Blocked: {r.blocked}</Badge>
              <Badge>Done: {r.done}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

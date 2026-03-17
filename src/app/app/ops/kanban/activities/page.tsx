import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getKanbanMeta, getTasksByType } from "@/lib/tasks.actions";
import { TaskType } from "@prisma/client";
import { ActivitiesBoard } from "@/components/kanban/ActivitiesBoard";
import { KanbanHeader } from "@/components/kanban/KanbanHeader";

export default async function ActivitiesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) redirect("/login");

  const [tasks, meta] = await Promise.all([
    getTasksByType(TaskType.ACTIVITY),
    getKanbanMeta(),
  ]);

  return (
    <div className="space-y-4">
      <KanbanHeader
        title="Actividades"
        subtitle="Kanban de operación (To Do / Doing / Bloqueado / Done)"
        type={TaskType.ACTIVITY}
        createdById={userId}
        users={meta.users}
        businesses={meta.businesses}
      />

      <ActivitiesBoard tasks={tasks} currentUserId={userId} />
    </div>
  );
}

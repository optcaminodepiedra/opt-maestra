import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getKanbanMeta, getTasksByType } from "@/lib/tasks.actions";
import { TaskType } from "@prisma/client";
import { TicketsTable } from "@/components/kanban/TicketsTable";
import { KanbanHeader } from "@/components/kanban/KanbanHeader";

export default async function TicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) redirect("/login");

  const [tasks, meta] = await Promise.all([
    getTasksByType(TaskType.TICKET),
    getKanbanMeta(),
  ]);

  return (
    <div className="space-y-4">
      <KanbanHeader
        title="Tickets / Solicitudes"
        subtitle="Vista tipo Jira/Notion (lista con propiedades)"
        type={TaskType.TICKET}
        createdById={userId}
        users={meta.users}
        businesses={meta.businesses}
      />

      <TicketsTable tasks={tasks} currentUserId={userId} />
    </div>
  );
}

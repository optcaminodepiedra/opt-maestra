import { getTasksByType } from "@/lib/tasks.actions";
import { ActivitiesBoard } from "@/components/kanban/ActivitiesBoard";
import { TaskType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ActivitiesPage() {
  const tasks = await getTasksByType(TaskType.ACTIVITY);
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Actividades</h2>
      <ActivitiesBoard
  tasks={tasks}
  currentUserId={userId}
/>
    </div>
  );
}

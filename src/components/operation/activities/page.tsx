import { ActivitiesBoard } from "@/components/kanban/ActivitiesBoard";
import { TaskCreateDialog } from "@/components/operation/TaskCreateDialog";
import { getBusinessesForSelect, getKanbanTasks, getTaskAssignees } from "@/lib/tasks";

export default async function ActivitiesPage() {
  const [tasks, assignees, businesses] = await Promise.all([
    getKanbanTasks("ACTIVITY"),
    getTaskAssignees(),
    getBusinessesForSelect(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Actividades</h1>
          <div className="text-sm text-muted-foreground">
            Trabajo interno del equipo (Kanban).
          </div>
        </div>

        <TaskCreateDialog type="ACTIVITY" assignees={assignees} businesses={businesses} />
      </div>

      <ActivitiesBoard tasks={tasks} currentUserId="temp-user" />
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TaskDTO } from "@/lib/tasks";

const priorityLabel: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const areaLabel: Record<string, string> = {
  OPERATIONS: "Operación",
  SYSTEMS: "Sistemas",
  MARKETING: "Marketing",
  ADMIN: "Admin",
};

export function TaskCard({
  task,
  onOpen,
}: {
  task: TaskDTO;
  onOpen: (t: TaskDTO) => void;
}) {
  const statusTone =
    task.status === "DONE"
      ? "bg-emerald-50"
      : task.status === "BLOCKED"
      ? "bg-amber-50"
      : task.status === "DOING"
      ? "bg-blue-50"
      : "bg-muted/30";

  return (
    <button className="text-left w-full" onClick={() => onOpen(task)}>
      <Card className={`p-3 hover:shadow-sm transition ${statusTone}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium leading-snug">{task.title}</div>
          <Badge variant={task.priority === "URGENT" ? "destructive" : "secondary"}>
            {priorityLabel[task.priority] ?? task.priority}
          </Badge>
        </div>

        <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-2">
          <span>{areaLabel[task.area] ?? task.area}</span>
          {task.businessName ? <span>• {task.businessName}</span> : null}
          {task.assignedName ? <span>• {task.assignedName}</span> : <span>• Sin asignar</span>}
        </div>
      </Card>
    </button>
  );
}

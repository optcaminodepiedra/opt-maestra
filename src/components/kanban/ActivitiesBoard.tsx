"use client";

import { useMemo, useState, useTransition } from "react";
import { TaskStatus } from "@prisma/client";
import { moveTask } from "@/lib/tasks.actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TaskModal } from "@/components/kanban/TaskModal";

type TaskAny = any;

const columns: { key: TaskStatus; label: string }[] = [
  { key: TaskStatus.TODO, label: "To Do" },
  { key: TaskStatus.DOING, label: "Doing" },
  { key: TaskStatus.BLOCKED, label: "Bloqueado" },
  { key: TaskStatus.DONE, label: "Done" },
];

export function ActivitiesBoard({ tasks, currentUserId }: { tasks: TaskAny[]; currentUserId: string }) {
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<TaskAny | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<string, TaskAny[]> = {
      TODO: [],
      DOING: [],
      BLOCKED: [],
      DONE: [],
    };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  function onDrop(status: TaskStatus) {
    if (!dragId) return;
    start(async () => {
      await moveTask(dragId, status);
      setDragId(null);
    });
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        {columns.map((col) => (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
            className={cn(
              "rounded-2xl border bg-card/50 p-3 min-h-[65vh]",
              "transition"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">{col.label}</div>
              <Badge variant="secondary">{byStatus[col.key]?.length ?? 0}</Badge>
            </div>

            <div className="space-y-2">
              {(byStatus[col.key] ?? []).map((t) => (
                <Card
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => setOpenTask(t)}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 hover:bg-muted/40",
                    dragId === t.id && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium leading-snug">{t.title}</div>
                    <Badge variant="outline">{t.priority}</Badge>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {t.description || "—"}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{t.area}</Badge>
                    <span className="text-muted-foreground">
                      {t.business?.name ? `• ${t.business.name}` : ""}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {t.assigned?.fullName ? t.assigned.fullName : "Sin asignar"}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <TaskModal
        open={!!openTask}
        onOpenChange={(v) => !v && setOpenTask(null)}
        task={openTask}
        currentUserId={currentUserId}
      />
      {pending ? <div className="text-xs text-muted-foreground">Actualizando…</div> : null}
    </>
  );
}

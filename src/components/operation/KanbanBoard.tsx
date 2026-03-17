"use client";

import { useMemo, useState } from "react";
import type { TaskDTO } from "@/lib/tasks";
import { TaskCard } from "@/components/operation/TaskCard";
import { TaskDrawer } from "@/components/operation/TaskDrawer";

const columns = [
  { key: "TODO", label: "Por hacer" },
  { key: "DOING", label: "En proceso" },
  { key: "BLOCKED", label: "Bloqueado" },
  { key: "DONE", label: "Hecho" },
] as const;

export function KanbanBoard({
  tasks,
  assignees,
  businesses,
}: {
  tasks: TaskDTO[];
  assignees: Array<{ id: string; name: string }>;
  businesses: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<TaskDTO | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, TaskDTO[]> = { TODO: [], DOING: [], BLOCKED: [], DONE: [] };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {columns.map((c) => (
        <div key={c.key} className="rounded-xl border bg-background">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted-foreground">{grouped[c.key].length} items</div>
          </div>

          <div className="p-3 space-y-3">
            {grouped[c.key].map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={(task) => {
                  setActive(task);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <TaskDrawer
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setActive(null);
        }}
        task={active}
        assignees={assignees}
        businesses={businesses}
      />
    </div>
  );
}

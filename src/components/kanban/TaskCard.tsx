"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type TaskFull = any;

function priorityLabel(p: string) {
  if (p === "URGENT") return "Urgente";
  if (p === "HIGH") return "Alta";
  if (p === "MEDIUM") return "Media";
  return "Baja";
}

export function TaskCard({ task, onOpen }: { task: TaskFull; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pr = task.priority ?? "LOW";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        "rounded-2xl border bg-background/80",
        "hover:shadow-md transition",
        isDragging && "opacity-70"
      )}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      role="button"
      tabIndex={0}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold leading-tight">{task.title}</div>
          <Badge variant={pr === "URGENT" ? "destructive" : "secondary"}>
            {priorityLabel(pr)}
          </Badge>
        </div>

        {task.description ? (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{task.area}</Badge>
          {task.business?.name ? <Badge variant="outline">{task.business.name}</Badge> : null}
          {task.assigned?.fullName ? (
            <Badge variant="secondary">{task.assigned.fullName}</Badge>
          ) : (
            <span className="text-muted-foreground">Sin responsable</span>
          )}
        </div>
      </div>
    </Card>
  );
}

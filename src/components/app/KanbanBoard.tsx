"use client";

import * as React from "react";
import { TaskStatus, Priority, TaskType, Area } from "@prisma/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createTask, moveTask } from "@/lib/tasks.actions";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  area: Area;
  businessName: string;
  assignedName: string;
  createdAt: string;
};

type BusinessOpt = { id: string; name: string };
type UserOpt = { id: string; fullName: string };

const COLS: Array<{ key: TaskStatus; title: string }> = [
  { key: "TODO", title: "Por hacer" },
  { key: "DOING", title: "En proceso" },
  { key: "BLOCKED", title: "Bloqueado" },
  { key: "DONE", title: "Hecho" },
];

function priorityTone(p: Priority) {
  if (p === "URGENT") return "destructive";
  if (p === "HIGH") return "default";
  return "secondary";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

export function KanbanBoard({
  title,
  type,
  tasks,
  businesses,
  users,
  createdById,
}: {
  title: string;
  type: TaskType;
  tasks: TaskRow[];
  businesses: BusinessOpt[];
  users: UserOpt[];
  createdById: string;
}) {
  const [open, setOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Priority,
    area: "OPERATIONS" as Area,
    businessId: "none",
    assignedId: "none",
  });

  const tasksBy = React.useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    for (const c of COLS) map[c.key] = [];
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  async function onCreate() {
    await createTask({
      title: form.title,
      description: form.description,
      type,
      status: "TODO",
      priority: form.priority,
      area: form.area,
      businessId: form.businessId === "none" ? null : form.businessId,
      assignedId: form.assignedId === "none" ? null : form.assignedId,
      createdById,
      dueDate: null,
    });

    setForm({
      title: "",
      description: "",
      priority: "MEDIUM",
      area: "OPERATIONS",
      businessId: "none",
      assignedId: "none",
    });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Operación</div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Crea tareas, muévelas por estatus y asigna responsables.
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nueva</Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Nueva tarea</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Título</div>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Ej. Revisar cierre de caja / Falta de insumos / Ajuste de menú…"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Descripción</div>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Contexto, pasos, referencia… (opcional)"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Prioridad</div>
                  <Select value={form.priority} onValueChange={(v) => setForm((s) => ({ ...s, priority: v as Priority }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Área</div>
                  <Select value={form.area} onValueChange={(v) => setForm((s) => ({ ...s, area: v as Area }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATIONS">Operaciones</SelectItem>
                      <SelectItem value="SYSTEMS">Sistemas</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="ADMIN">Administración</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Unidad (opcional)</div>
                  <Select value={form.businessId} onValueChange={(v) => setForm((s) => ({ ...s, businessId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin unidad</SelectItem>
                      {businesses.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Asignar a (opcional)</div>
                  <Select value={form.assignedId} onValueChange={(v) => setForm((s) => ({ ...s, assignedId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={onCreate} disabled={!form.title.trim()}>
                  Crear
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Board */}
      <div className="grid gap-3 lg:grid-cols-4">
        {COLS.map((col) => (
          <Card key={col.key} className="bg-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{col.title}</div>
                <Badge variant="secondary" className="tabular-nums">
                  {tasksBy[col.key].length}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {tasksBy[col.key].length === 0 ? (
                <div className="text-xs text-muted-foreground">Sin elementos.</div>
              ) : (
                tasksBy[col.key].map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border bg-background p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-snug truncate">{t.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {t.businessName || "Sin unidad"} • {t.assignedName || "Sin asignar"}
                        </div>
                      </div>

                      <Badge variant={priorityTone(t.priority) as any} className="shrink-0">
                        {t.priority}
                      </Badge>
                    </div>

                    {t.description ? (
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted-foreground">{fmtDate(t.createdAt)}</div>

                      <div className="flex items-center gap-1">
                        {col.key !== "TODO" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveTask(t.id, "TODO")}
                          >
                            Todo
                          </Button>
                        )}
                        {col.key !== "DOING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveTask(t.id, "DOING")}
                          >
                            Doing
                          </Button>
                        )}
                        {col.key !== "BLOCKED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveTask(t.id, "BLOCKED")}
                          >
                            Block
                          </Button>
                        )}
                        {col.key !== "DONE" && (
                          <Button
                            size="sm"
                            onClick={() => moveTask(t.id, "DONE")}
                          >
                            Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

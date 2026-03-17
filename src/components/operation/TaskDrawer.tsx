"use client";

import { useMemo } from "react";
import type { TaskDTO } from "@/lib/tasks";
import { updateTask } from "@/lib/tasks.actions";

async function quickMoveTaskStatus(formData: FormData) {
  await updateTask(formData.get("id") as string, {
    status: formData.get("status") as any,
  });
}
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const statuses = [
  { value: "TODO", label: "Por hacer" },
  { value: "DOING", label: "En proceso" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "DONE", label: "Hecho" },
] as const;

const priorities = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
] as const;

const areas = [
  { value: "OPERATIONS", label: "Operación" },
  { value: "SYSTEMS", label: "Sistemas" },
  { value: "MARKETING", label: "Marketing" },
  { value: "ADMIN", label: "Admin" },
] as const;

export function TaskDrawer({
  open,
  onOpenChange,
  task,
  assignees,
  businesses,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskDTO | null;
  assignees: Array<{ id: string; name: string }>;
  businesses: Array<{ id: string; name: string }>;
}) {
  const dueDateValue = useMemo(() => {
    if (!task?.dueDate) return "";
    // input type="date" requiere YYYY-MM-DD
    return task.dueDate.slice(0, 10);
  }, [task?.dueDate]);

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalle</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Quick move */}
          <form action={quickMoveTaskStatus} className="flex items-center gap-2">
            <input type="hidden" name="id" value={task.id} />
            <Select name="status" defaultValue={task.status}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              Mover
            </Button>
          </form>

          <Separator />

          {/* Full edit */}
          <form
            action={async (formData) => {
              const priority = formData.get("priority") as string;
              const area = formData.get("area") as string;
              await updateTask(task.id, {
                title: formData.get("title") as string,
                description: formData.get("description") as string,
                priority: priority as any,
                area: area as any,
                businessId: formData.get("businessId") as string || null,
                assignedId: formData.get("assignedId") as string || null,
                dueDate: formData.get("dueDate") as string || null,
              });
            }}
            className="space-y-4"
          >

            <div className="space-y-2">
              <Label>Título</Label>
              <Input name="title" defaultValue={task.title} />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea name="description" defaultValue={task.description} rows={5} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select name="priority" defaultValue={task.priority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Área</Label>
                <Select name="area" defaultValue={task.area}>
                  <SelectTrigger>
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Negocio</Label>
                <Select name="businessId" defaultValue={task.businessId ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sin negocio —</SelectItem>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asignado</Label>
                <Select name="assignedId" defaultValue={task.assignedId ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sin asignar —</SelectItem>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha límite</Label>
                <Input name="dueDate" type="date" defaultValue={dueDateValue} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

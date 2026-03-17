"use client";

import { createTask } from "@/lib/tasks.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export function TaskCreateDialog({
  type,
  assignees,
  businesses,
}: {
  type: "ACTIVITY" | "TICKET";
  assignees: Array<{ id: string; name: string }>;
  businesses: Array<{ id: string; name: string }>;
}) {
  const handleSubmit = async (formData: FormData) => {
    const data = {
      type: formData.get("type") as "ACTIVITY" | "TICKET",
      status: (formData.get("status") as string) as any,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      priority: formData.get("priority") as any,
      area: formData.get("area") as any,
      businessId: formData.get("businessId") as string || undefined,
      assignedId: formData.get("assignedId") as string || undefined,
      dueDate: formData.get("dueDate") as string || undefined,
      createdById: "", // TODO: Replace with actual user ID from session/context
    };
    await createTask(data);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Nueva</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{type === "ACTIVITY" ? "Nueva actividad" : "Nuevo ticket"}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="status" value="TODO" />

          <div className="space-y-2">
            <Label>Título</Label>
            <Input name="title" placeholder="Ej. Configurar caja Bodega 4" />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea name="description" rows={4} placeholder="Contexto, pasos, links, etc." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select name="priority" defaultValue="MEDIUM">
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
              <Select name="area" defaultValue="OPERATIONS">
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
              <Select name="businessId" defaultValue="">
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
              <Select name="assignedId" defaultValue="">
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
              <Input name="dueDate" type="date" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

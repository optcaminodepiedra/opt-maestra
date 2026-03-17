"use client";

import { useMemo, useState, useTransition } from "react";
import { TaskType, TaskStatus, Priority, Area } from "@prisma/client";
import { createTask } from "@/lib/tasks.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MiniUser = { id: string; fullName: string; role: string };
type MiniBiz = { id: string; name: string };

export function KanbanHeader(props: {
  title: string;
  subtitle: string;
  type: TaskType;
  createdById: string;
  users: MiniUser[];
  businesses: MiniBiz[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [area, setArea] = useState<Area>(Area.OPERATIONS);

  const [businessId, setBusinessId] = useState<string>("__none__");
  const [assignedId, setAssignedId] = useState<string>("__none__");

  const [startDate, setStartDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const btnLabel = useMemo(() => (props.type === TaskType.ACTIVITY ? "Nueva actividad" : "Nuevo ticket"), [props.type]);

  function reset() {
    setTitle("");
    setDescription("");
    setStatus(TaskStatus.TODO);
    setPriority(Priority.MEDIUM);
    setArea(Area.OPERATIONS);
    setBusinessId("__none__");
    setAssignedId("__none__");
    setStartDate("");
    setDueDate("");
    setEndDate("");
  }

  async function onCreate() {
    start(async () => {
      await createTask({
        title,
        description,
        type: props.type,
        status,
        priority,
        area,
        businessId: businessId === "__none__" ? null : businessId,
        assignedId: assignedId === "__none__" ? null : assignedId,
        createdById: props.createdById,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });

      setOpen(false);
      reset();
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        <p className="text-sm text-muted-foreground">{props.subtitle}</p>
      </div>

      <Button onClick={() => setOpen(true)} disabled={pending}>
        {btnLabel}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), reset()))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{btnLabel}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Revisar corte de caja / Falla impresora / Ajuste inventario" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe el contexto, criterios de terminado, links, etc." />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskStatus.TODO}>To Do</SelectItem>
                  <SelectItem value={TaskStatus.DOING}>Doing</SelectItem>
                  <SelectItem value={TaskStatus.BLOCKED}>Bloqueado</SelectItem>
                  <SelectItem value={TaskStatus.DONE}>Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={Priority.LOW}>Low</SelectItem>
                  <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={Priority.HIGH}>High</SelectItem>
                  <SelectItem value={Priority.URGENT}>Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={area} onValueChange={(v) => setArea(v as Area)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={Area.OPERATIONS}>Operación</SelectItem>
                  <SelectItem value={Area.SYSTEMS}>Sistemas</SelectItem>
                  <SelectItem value={Area.MARKETING}>Marketing</SelectItem>
                  <SelectItem value={Area.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(Sin unidad)</SelectItem>
                  {props.businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={assignedId} onValueChange={setAssignedId}>
                <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(Sin asignar)</SelectItem>
                  {props.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Fecha compromiso</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Fecha fin real</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => (setOpen(false), reset())} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={onCreate} disabled={pending || !title.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

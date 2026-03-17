"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { TaskStatus, Priority, Area } from "@prisma/client";
import { addTaskAttachment, addTaskComment, updateTask } from "@/lib/tasks.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type TaskAny = any;

function isoDateInput(d?: string | Date | null) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskAny | null;
  currentUserId: string;
}) {
  const [pending, start] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [area, setArea] = useState<Area>(Area.OPERATIONS);

  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [comment, setComment] = useState("");
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");

  const comments = useMemo(() => task?.comments ?? [], [task]);
  const attachments = useMemo(() => task?.attachments ?? [], [task]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status ?? TaskStatus.TODO);
    setPriority(task.priority ?? Priority.MEDIUM);
    setArea(task.area ?? Area.OPERATIONS);
    setStartDate(isoDateInput(task.startDate));
    setDueDate(isoDateInput(task.dueDate));
    setEndDate(isoDateInput(task.endDate));
    setComment("");
    setAttName("");
    setAttUrl("");
  }, [task]);

  function savePatch(patch: any) {
    if (!task?.id) return;
    start(async () => {
      await updateTask(task.id, patch);
    });
  }

  function onSaveAll() {
    savePatch({
      title,
      description,
      status,
      priority,
      area,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    });
  }

  function onAddComment() {
    if (!task?.id) return;
    start(async () => {
      await addTaskComment({ taskId: task.id, userId: currentUserId, body: comment });
      setComment("");
    });
  }

  function onAddAttachment() {
    if (!task?.id) return;
    start(async () => {
      await addTaskAttachment({ taskId: task.id, userId: currentUserId, name: attName, url: attUrl });
      setAttName("");
      setAttUrl("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Detalle</span>
            {task?.type ? <Badge variant="secondary">{task.type}</Badge> : null}
          </DialogTitle>
        </DialogHeader>

        {!task ? null : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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
              <Label>Inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Compromiso</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Fin real</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="text-xs text-muted-foreground md:col-span-2">
              Creado por: <span className="font-medium">{task.createdBy?.fullName ?? "—"}</span>
              {task.assigned?.fullName ? (
                <> • Responsable: <span className="font-medium">{task.assigned.fullName}</span></>
              ) : null}
              {task.business?.name ? (
                <> • Unidad: <span className="font-medium">{task.business.name}</span></>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Separator className="my-2" />
              <div className="font-semibold mb-2">Comentarios</div>

              <div className="space-y-2 max-h-40 overflow-auto rounded-xl border p-3 bg-muted/20">
                {comments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin comentarios.</div>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className="text-sm">
                      <div className="text-xs text-muted-foreground">
                        {c.user?.fullName ?? "—"} •{" "}
                        {new Date(c.createdAt).toLocaleString("es-MX")}
                      </div>
                      <div>{c.body}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario… (mentions/adjuntos avanzados lo mejoramos después)" />
                <Button onClick={onAddComment} disabled={pending || !comment.trim()}>
                  Comentar
                </Button>
              </div>
            </div>

            <div className="md:col-span-2">
              <Separator className="my-2" />
              <div className="font-semibold mb-2">Adjuntos (por URL)</div>

              <div className="space-y-2 max-h-32 overflow-auto rounded-xl border p-3 bg-muted/20">
                {attachments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin adjuntos.</div>
                ) : (
                  attachments.map((a: any) => (
                    <div key={a.id} className="text-sm flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {a.user?.fullName ?? "—"} •{" "}
                          {new Date(a.createdAt).toLocaleString("es-MX")}
                        </div>
                        <div className="font-medium">{a.name}</div>
                      </div>
                      <a className="text-sm underline" href={a.url} target="_blank" rel="noreferrer">
                        abrir
                      </a>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="Ej. Captura, PDF, link, etc." />
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input value={attUrl} onChange={(e) => setAttUrl(e.target.value)} placeholder="https://..." />
                </div>
                <Button className="md:col-span-2" onClick={onAddAttachment} disabled={pending || !attName.trim() || !attUrl.trim()}>
                  Agregar adjunto
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cerrar
          </Button>
          <Button onClick={onSaveAll} disabled={pending || !title.trim()}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

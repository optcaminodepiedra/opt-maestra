"use client";

import * as React from "react";
import { TaskStatus, Priority, Area } from "@prisma/client";
import { addTaskAttachment, addTaskComment, updateTask } from "@/lib/tasks.actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type TaskFull = any;

function moneyDate(d?: string | Date | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("es-MX", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskFull | null;
}) {
  const [comment, setComment] = React.useState("");
  const [attName, setAttName] = React.useState("");
  const [attUrl, setAttUrl] = React.useState("");

  React.useEffect(() => {
    setComment("");
    setAttName("");
    setAttUrl("");
  }, [task?.id]);

  if (!task) return null;

  async function onChangeStatus(v: TaskStatus) {
    await updateTask(task.id, { status: v });
  }

  async function onChangePriority(v: Priority) {
    await updateTask(task.id, { priority: v });
  }

  async function onChangeArea(v: Area) {
    await updateTask(task.id, { area: v });
  }

  // Nota: por ahora no estamos trayendo lista de users aquí. Lo dejamos para el siguiente paso (selector real).
  // Puedes asignar desde DB/seed o lo conectamos luego con un dropdown poblado.
  // (Si quieres, en el siguiente paso hacemos "selector de usuario" con search.)
  async function onPostComment() {
    // Para demo: usamos createdBy como autor si no tienes el userId del session aquí.
    // En el siguiente paso lo conectamos con session real en client.
    const userId = task.createdById as string;
    await addTaskComment({
  taskId: task.id,
  userId,
  body: comment,
});
    setComment("");
  }

  async function onAddAttachment() {
    const userId = task.createdById as string;
    await addTaskAttachment({
  taskId: task.id,
  userId,
  name: attName || "Adjunto",
  url: attUrl,
});
    setAttName("");
    setAttUrl("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Detalle</div>
              <div className="text-xl font-semibold">{task.title}</div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{task.type}</Badge>
              <Badge variant="outline">{task.status}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-3">
            <div className="rounded-2xl border bg-muted/10 p-3">
              <div className="text-xs text-muted-foreground mb-1">Descripción</div>
              <div className="text-sm whitespace-pre-wrap">
                {task.description || "—"}
              </div>
            </div>

            <div className="rounded-2xl border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Comentarios</div>
                <div className="text-xs text-muted-foreground">
                  {task.comments?.length ?? 0}
                </div>
              </div>

              <div className="max-h-56 overflow-auto space-y-3 pr-1">
                {(task.comments ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin comentarios.</div>
                ) : (
                  (task.comments ?? []).map((c: any) => (
                    <div key={c.id} className="rounded-xl bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.user?.fullName ?? "—"}</span>
                        <span>{moneyDate(c.createdAt)}</span>
                      </div>
                      <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escribe un comentario... (puedes mencionar con @usuario después lo conectamos)"
                />
                <div className="flex justify-end">
                  <Button onClick={onPostComment} disabled={!comment.trim()}>
                    Comentar
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Adjuntos</div>
                <div className="text-xs text-muted-foreground">
                  {task.attachments?.length ?? 0}
                </div>
              </div>

              {(task.attachments ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin adjuntos.</div>
              ) : (
                <div className="space-y-2">
                  {(task.attachments ?? []).map((a: any) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      className="block rounded-xl bg-muted/20 p-3 hover:bg-muted/30 transition"
                      rel="noreferrer"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{moneyDate(a.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{a.url}</div>
                    </a>
                  ))}
                </div>
              )}

              <Separator />

              <div className="grid gap-2 md:grid-cols-3">
                <Input value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="Nombre del adjunto" />
                <Input value={attUrl} onChange={(e) => setAttUrl(e.target.value)} placeholder="URL (Drive/WhatsApp/etc)" className="md:col-span-2" />
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onAddAttachment} disabled={!attUrl.trim()}>
                  Agregar adjunto
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border p-3 space-y-3">
              <div className="font-semibold">Propiedades</div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Status</div>
                <Select value={task.status} onValueChange={(v) => onChangeStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">TODO</SelectItem>
                    <SelectItem value="DOING">DOING</SelectItem>
                    <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                    <SelectItem value="DONE">DONE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Prioridad</div>
                <Select value={task.priority} onValueChange={(v) => onChangePriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">LOW</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                    <SelectItem value="HIGH">HIGH</SelectItem>
                    <SelectItem value="URGENT">URGENT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Área</div>
                <Select value={task.area} onValueChange={(v) => onChangeArea(v as Area)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATIONS">OPERATIONS</SelectItem>
                    <SelectItem value="SYSTEMS">SYSTEMS</SelectItem>
                    <SelectItem value="MARKETING">MARKETING</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground">Unidad</div>
              <div className="text-sm">{task.business?.name ?? "—"}</div>

              <div className="text-xs text-muted-foreground mt-2">Responsable</div>
              <div className="text-sm">{task.assigned?.fullName ?? "—"}</div>

              <Separator />

              <div className="text-xs text-muted-foreground">Fechas</div>
              <div className="text-sm space-y-1">
                <div>Inicio: {moneyDate(task.startDate)}</div>
                <div>Compromiso: {moneyDate(task.dueDate)}</div>
                <div>Fin: {moneyDate(task.endDate)}</div>
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground">Creado por</div>
              <div className="text-sm">{task.createdBy?.fullName ?? "—"}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

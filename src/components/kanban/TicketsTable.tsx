"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TaskModal } from "@/components/kanban/TaskModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TaskAny = any;

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("es-MX");
}

export function TicketsTable({ tasks, currentUserId }: { tasks: TaskAny[]; currentUserId: string }) {
  const [openTask, setOpenTask] = useState<TaskAny | null>(null);

  const rows = useMemo(() => tasks ?? [], [tasks]);

  return (
    <>
      <Card className="rounded-2xl p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Compromiso</TableHead>
              <TableHead>Fin real</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  Sin tickets.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow
                  key={t.id}
                  onClick={() => setOpenTask(t)}
                  className={cn("cursor-pointer hover:bg-muted/40")}
                >
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t.area}</Badge>
                  </TableCell>
                  <TableCell>{t.business?.name ?? "—"}</TableCell>
                  <TableCell>{t.assigned?.fullName ?? "—"}</TableCell>
                  <TableCell>{fmtDate(t.startDate)}</TableCell>
                  <TableCell>{fmtDate(t.dueDate)}</TableCell>
                  <TableCell>{fmtDate(t.endDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <TaskModal
        open={!!openTask}
        onOpenChange={(v) => !v && setOpenTask(null)}
        task={openTask}
        currentUserId={currentUserId}
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, X, Pencil, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  createScheduledShift,
  updateScheduledShift,
  cancelScheduledShift,
  deleteScheduledShift,
  copyWeekShifts,
} from "@/lib/schedule.actions";
import type { ScheduledShiftStatus } from "@prisma/client";

type ShiftLite = {
  id: string;
  userId: string;
  userName: string;
  jobTitle: string | null;
  dateIso: string;
  startTime: string | null;
  endTime: string | null;
  role: string | null;
  note: string | null;
  status: ScheduledShiftStatus;
};

type Candidate = {
  id: string;
  fullName: string;
  username: string;
  jobTitle: string | null;
  role: string;
};

type Props = {
  businessId: string;
  weekStartIso: string;
  days: string[]; // 7 ISO dates
  shifts: ShiftLite[];
  candidates: Candidate[];
};

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function statusBadge(status: ScheduledShiftStatus) {
  switch (status) {
    case "CONFIRMED":
      return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    case "ABSENT":
      return <XCircle className="w-3 h-3 text-red-600" />;
    case "CANCELED":
      return <X className="w-3 h-3 text-gray-400" />;
    default:
      return <Clock className="w-3 h-3 text-blue-500" />;
  }
}

export function WeekScheduleClient({
  businessId,
  weekStartIso,
  days,
  shifts,
  candidates,
}: Props) {
  const [pending, start] = useTransition();
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftLite | null>(null);

  const shiftsByDate = days.reduce<Record<string, ShiftLite[]>>((acc, d) => {
    acc[d] = shifts
      .filter((s) => s.dateIso === d && s.status !== "CANCELED")
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    return acc;
  }, {});

  function copyFromPreviousWeek() {
    if (!confirm("¿Copiar la plantilla de la semana anterior a esta semana? No sobrescribe turnos existentes.")) return;
    const prevWeek = new Date(weekStartIso + "T00:00:00.000Z");
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    const prevIso = prevWeek.toISOString().slice(0, 10);

    start(async () => {
      try {
        const result = await copyWeekShifts({
          businessId,
          fromWeekMondayIso: prevIso,
          toWeekMondayIso: weekStartIso,
          overwrite: false,
        });
        alert(`Copiados: ${result.copied}. Ya existían: ${result.skipped}.`);
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={copyFromPreviousWeek} disabled={pending}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar semana anterior
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2">
        {days.map((dateIso, idx) => {
          const dayShifts = shiftsByDate[dateIso] ?? [];
          const date = new Date(dateIso + "T00:00:00.000Z");
          const isToday = dateIso === new Date().toISOString().slice(0, 10);

          return (
            <Card key={dateIso} className={isToday ? "border-primary border-2" : ""}>
              <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    {DAY_NAMES[idx]}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
                    {date.getUTCDate()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setAddingForDate(dateIso)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              <CardContent className="p-2 space-y-1 min-h-[120px]">
                {dayShifts.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground text-center py-4">
                    Sin turnos
                  </div>
                ) : (
                  dayShifts.map((s) => (
                    <div
                      key={s.id}
                      className="text-xs border rounded-md p-1.5 bg-background hover:bg-muted/30 cursor-pointer group"
                      onClick={() => setEditingShift(s)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="font-medium truncate">{s.userName.split(" ")[0]}</div>
                        {statusBadge(s.status)}
                      </div>
                      {(s.startTime || s.role) && (
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {s.startTime && `${s.startTime}${s.endTime ? `-${s.endTime}` : ""}`}
                          {s.startTime && s.role ? " · " : ""}
                          {s.role}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal añadir turno */}
      {addingForDate && (
        <AddShiftModal
          businessId={businessId}
          dateIso={addingForDate}
          candidates={candidates.filter(
            (c) => !shifts.some((s) => s.userId === c.id && s.dateIso === addingForDate && s.status !== "CANCELED")
          )}
          pending={pending}
          onSubmit={(data) => {
            start(async () => {
              try {
                await createScheduledShift(data);
                setAddingForDate(null);
              } catch (err: any) {
                alert(err.message);
              }
            });
          }}
          onClose={() => setAddingForDate(null)}
        />
      )}

      {/* Modal editar turno */}
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          pending={pending}
          onSave={(data) => {
            start(async () => {
              try {
                await updateScheduledShift({ shiftId: editingShift.id, ...data });
                setEditingShift(null);
              } catch (err: any) {
                alert(err.message);
              }
            });
          }}
          onCancelShift={() => {
            if (!confirm(`¿Cancelar el turno de ${editingShift.userName}?`)) return;
            start(async () => {
              try {
                await cancelScheduledShift(editingShift.id);
                setEditingShift(null);
              } catch (err: any) {
                alert(err.message);
              }
            });
          }}
          onDeleteShift={() => {
            if (!confirm(`¿Eliminar definitivamente el turno de ${editingShift.userName}?`)) return;
            start(async () => {
              try {
                await deleteScheduledShift(editingShift.id);
                setEditingShift(null);
              } catch (err: any) {
                alert(err.message);
              }
            });
          }}
          onClose={() => setEditingShift(null)}
        />
      )}
    </>
  );
}

/* ────────── Subcomponentes modales ────────── */

function AddShiftModal({
  businessId,
  dateIso,
  candidates,
  pending,
  onSubmit,
  onClose,
}: {
  businessId: string;
  dateIso: string;
  candidates: Candidate[];
  pending: boolean;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");

  const dateLabel = new Date(dateIso + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="text-base font-semibold">Programar turno</h3>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{dateLabel}</p>
          </div>
          <button onClick={onClose} disabled={pending} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Todos los empleados disponibles ya tienen turno este día.
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Empleado</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} {c.jobTitle ? `· ${c.jobTitle}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Entrada</label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full h-10 px-2 border rounded-lg text-sm bg-background mt-1"
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Salida</label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full h-10 px-2 border rounded-lg text-sm bg-background mt-1"
                  disabled={pending}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Rol / Área</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Cocina, Barra, Recepción..."
                className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Nota (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  onSubmit({
                    businessId,
                    dateIso,
                    userId,
                    startTime: start || null,
                    endTime: end || null,
                    role: role || null,
                    note: note || null,
                  })
                }
                disabled={pending || !userId}
              >
                Programar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditShiftModal({
  shift,
  pending,
  onSave,
  onCancelShift,
  onDeleteShift,
  onClose,
}: {
  shift: ShiftLite;
  pending: boolean;
  onSave: (d: { startTime: string | null; endTime: string | null; role: string | null; note: string | null }) => void;
  onCancelShift: () => void;
  onDeleteShift: () => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState(shift.startTime ?? "");
  const [end, setEnd] = useState(shift.endTime ?? "");
  const [role, setRole] = useState(shift.role ?? "");
  const [note, setNote] = useState(shift.note ?? "");

  const today = new Date().toISOString().slice(0, 10);
  const isPast = shift.dateIso < today;
  const canDelete = !isPast && shift.status === "PLANNED";

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="text-base font-semibold">{shift.userName}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(shift.dateIso + "T00:00:00").toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <button onClick={onClose} disabled={pending} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Entrada</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full h-10 px-2 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Salida</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full h-10 px-2 border rounded-lg text-sm bg-background mt-1"
                disabled={pending}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Rol / Área</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Nota</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3 border rounded-lg text-sm bg-background mt-1"
              disabled={pending}
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex gap-1">
              {shift.status === "PLANNED" && (
                <Button variant="ghost" size="sm" className="text-amber-600 hover:bg-amber-50" onClick={onCancelShift} disabled={pending}>
                  Cancelar turno
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={onDeleteShift} disabled={pending}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cerrar
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  onSave({
                    startTime: start || null,
                    endTime: end || null,
                    role: role || null,
                    note: note || null,
                  })
                }
                disabled={pending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

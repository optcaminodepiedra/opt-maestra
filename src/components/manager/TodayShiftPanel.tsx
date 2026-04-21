"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  createScheduledShift,
  updateScheduledShift,
  cancelScheduledShift,
  deleteScheduledShift,
} from "@/lib/schedule.actions";
import type { TodayShiftRow } from "@/lib/schedule";
import type { ScheduledShiftStatus } from "@prisma/client";

type Candidate = {
  id: string;
  fullName: string;
  username: string;
  jobTitle: string | null;
  role: string;
};

type Props = {
  businessId: string;
  businessName: string;
  dateIso: string;
  shifts: TodayShiftRow[];
  candidates: Candidate[];
};

function statusBadge(status: ScheduledShiftStatus, hasClockedIn: boolean) {
  if (status === "CONFIRMED" || (status === "PLANNED" && hasClockedIn)) {
    return (
      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Presente
      </Badge>
    );
  }
  if (status === "ABSENT") {
    return (
      <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
        <XCircle className="w-3 h-3 mr-1" /> No asistió
      </Badge>
    );
  }
  if (status === "CANCELED") {
    return (
      <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200 text-[10px]">
        Cancelado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
      <Clock className="w-3 h-3 mr-1" /> Programado
    </Badge>
  );
}

export function TodayShiftPanel({ businessId, businessName, dateIso, shifts, candidates }: Props) {
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const dateLabel = new Date(dateIso + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalPlanned = shifts.filter((s) => s.status === "PLANNED" || s.status === "CONFIRMED").length;
  const totalPresent = shifts.filter((s) => s.hasClockedIn).length;

  const usedUserIds = new Set(shifts.map((s) => s.userId));
  const availableCandidates = candidates.filter((c) => !usedUserIds.has(c.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Plantilla de hoy
          </CardTitle>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/manager/schedule?businessId=${businessId}`}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" /> Semana completa
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAdd((v) => !v)}
              disabled={availableCandidates.length === 0}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {businessName} · {dateLabel} · {totalPresent} de {totalPlanned} presentes
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {/* Formulario para agregar */}
        {showAdd && availableCandidates.length > 0 && (
          <AddShiftForm
            businessId={businessId}
            dateIso={dateIso}
            candidates={availableCandidates}
            pending={pending}
            onSubmit={(data) => {
              start(async () => {
                try {
                  await createScheduledShift(data);
                  setShowAdd(false);
                } catch (err: any) {
                  alert(err.message);
                }
              });
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Lista de turnos */}
        {shifts.length === 0 ? (
          <div className="py-8 px-4 text-center text-sm text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p>No hay plantilla programada para hoy.</p>
            {availableCandidates.length > 0 && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Programar primer turno
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {shifts.map((s) => (
              <ShiftRow
                key={s.shiftId}
                shift={s}
                isEditing={editingId === s.shiftId}
                onStartEdit={() => setEditingId(s.shiftId)}
                onStopEdit={() => setEditingId(null)}
                onSaveEdit={(data) => {
                  start(async () => {
                    try {
                      await updateScheduledShift({ shiftId: s.shiftId, ...data });
                      setEditingId(null);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  });
                }}
                onCancel={() => {
                  if (!confirm(`¿Cancelar el turno de ${s.fullName}?`)) return;
                  start(async () => {
                    try {
                      await cancelScheduledShift(s.shiftId);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  });
                }}
                onDelete={() => {
                  if (!confirm(`¿Eliminar definitivamente el turno de ${s.fullName}?`)) return;
                  start(async () => {
                    try {
                      await deleteScheduledShift(s.shiftId);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  });
                }}
                pending={pending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Subcomponentes ───────────────────────── */

function ShiftRow({
  shift,
  isEditing,
  onStartEdit,
  onStopEdit,
  onSaveEdit,
  onCancel,
  onDelete,
  pending,
}: {
  shift: TodayShiftRow;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onSaveEdit: (d: { startTime: string | null; endTime: string | null; role: string | null; note: string | null }) => void;
  onCancel: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [start, setStart] = useState(shift.startTime ?? "");
  const [end, setEnd] = useState(shift.endTime ?? "");
  const [role, setRole] = useState(shift.role ?? "");
  const [note, setNote] = useState(shift.note ?? "");

  if (isEditing) {
    return (
      <div className="p-4 bg-muted/30 space-y-3">
        <p className="text-sm font-medium">{shift.fullName}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Entrada</label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full h-8 px-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Salida</label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full h-8 px-2 border rounded text-sm"
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
            className="w-full h-8 px-2 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Nota</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opcional"
            className="w-full h-8 px-2 border rounded text-sm"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onStopEdit} disabled={pending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onSaveEdit({
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
    );
  }

  const disableEdit = shift.status === "CANCELED";
  const showDelete = shift.status === "PLANNED" && !shift.hasClockedIn;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold">
          {shift.fullName
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{shift.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {shift.role ?? shift.jobTitle ?? "Sin rol asignado"}
            {shift.startTime && (
              <>
                {" · "}
                {shift.startTime}
                {shift.endTime ? ` – ${shift.endTime}` : ""}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {statusBadge(shift.status, shift.hasClockedIn)}
        {!disableEdit && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onStartEdit} disabled={pending}>
            <Pencil className="w-3 h-3" />
          </Button>
        )}
        {showDelete ? (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={onDelete} disabled={pending}>
            <Trash2 className="w-3 h-3" />
          </Button>
        ) : (
          shift.status === "PLANNED" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50" onClick={onCancel} disabled={pending}>
              Cancelar
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function AddShiftForm({
  businessId,
  dateIso,
  candidates,
  pending,
  onSubmit,
  onCancel,
}: {
  businessId: string;
  dateIso: string;
  candidates: Candidate[];
  pending: boolean;
  onSubmit: (data: {
    userId: string;
    businessId: string;
    dateIso: string;
    startTime: string | null;
    endTime: string | null;
    role: string | null;
    note: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="p-4 bg-blue-50/50 border-b space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Empleado</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full h-9 px-2 border rounded text-sm bg-white"
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
              className="w-full h-9 px-2 border rounded text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Salida</label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full h-9 px-2 border rounded text-sm bg-white"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Rol / Área (opcional)</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Cocina, Barra, Recepción..."
            className="w-full h-9 px-2 border rounded text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Nota (opcional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-9 px-2 border rounded text-sm bg-white"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSubmit({
              userId,
              businessId,
              dateIso,
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
  );
}

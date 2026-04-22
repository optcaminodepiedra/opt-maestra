"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, X, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { requestVacation, decideVacation, cancelVacation } from "@/lib/vacations.actions";

type Request = {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  type: "VACATION" | "UNPAID_LEAVE" | "SICK_LEAVE" | "PERSONAL";
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  note: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
};

type Balance = {
  year: number;
  earnedDays: number;
  usedDays: number;
  pendingDays: number;
};

type Props = {
  balance: Balance | null;
  myRequests: Request[];
  teamRequests: Request[];
  canApprove: boolean;
  viewerUserId: string;
};

const TYPE_LABEL = {
  VACATION: "Vacaciones",
  UNPAID_LEAVE: "Sin goce",
  SICK_LEAVE: "Incapacidad",
  PERSONAL: "Personal",
};

const STATUS_CONFIG = {
  PENDING:  { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  APPROVED: { label: "Aprobada",   cls: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle2 },
  REJECTED: { label: "Rechazada",  cls: "bg-red-50 text-red-700 border-red-200",        icon: XCircle },
  CANCELED: { label: "Cancelada",  cls: "bg-gray-50 text-gray-600 border-gray-200",     icon: X },
};

export function VacationsClient({ balance, myRequests, teamRequests, canApprove, viewerUserId }: Props) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState<Request["type"]>("VACATION");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  const remainingDays = balance ? balance.earnedDays - balance.usedDays - balance.pendingDays : 0;

  function submit() {
    setError(null);
    if (!startDate || !endDate) return setError("Completa ambas fechas.");
    start(async () => {
      try {
        await requestVacation({
          startDateIso: startDate,
          endDateIso: endDate,
          type,
          note: note || undefined,
        });
        setShowForm(false);
        setStartDate(""); setEndDate(""); setNote("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function decide(decision: "APPROVED" | "REJECTED", requestId: string) {
    start(async () => {
      try {
        await decideVacation({ requestId, decision, decisionNote: decisionNote || undefined });
        setDecisionId(null);
        setDecisionNote("");
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function cancel(requestId: string) {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    start(async () => {
      try { await cancelVacation(requestId); }
      catch (err: any) { alert(err.message); }
    });
  }

  return (
    <div className="space-y-6">
      {/* Balance */}
      {balance && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tu balance {balance.year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Disponibles" value={remainingDays} color={remainingDays > 0 ? "text-green-600" : "text-red-600"} />
              <StatBox label="Usados" value={balance.usedDays} />
              <StatBox label="Pendientes" value={balance.pendingDays} color="text-amber-600" />
              <StatBox label="Total ganados" value={balance.earnedDays} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mis solicitudes */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Mis solicitudes</CardTitle>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Solicitar vacaciones
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {showForm && (
            <div className="p-4 bg-blue-50/30 border-b space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Desde</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 px-2 border rounded text-sm bg-white mt-1" disabled={pending} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Hasta</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 px-2 border rounded text-sm bg-white mt-1" disabled={pending} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as Request["type"])}
                  className="w-full h-9 px-2 border rounded text-sm bg-white mt-1" disabled={pending}>
                  <option value="VACATION">Vacaciones (descuenta del balance)</option>
                  <option value="PERSONAL">Permiso personal</option>
                  <option value="SICK_LEAVE">Incapacidad</option>
                  <option value="UNPAID_LEAVE">Sin goce de sueldo</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Motivo (opcional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  className="w-full px-2 py-1.5 border rounded text-sm bg-white mt-1 resize-none" disabled={pending} />
              </div>
              {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={pending}>Cancelar</Button>
                <Button size="sm" onClick={submit} disabled={pending}>{pending ? "Enviando..." : "Enviar solicitud"}</Button>
              </div>
            </div>
          )}

          {myRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No has hecho solicitudes. Usa el botón de arriba para empezar.
            </div>
          ) : (
            <div className="divide-y">
              {myRequests.map((r) => <RequestRow key={r.id} req={r} showUser={false} canCancel={r.status === "PENDING" || r.status === "APPROVED"} onCancel={() => cancel(r.id)} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Del equipo (solo si puede aprobar) */}
      {canApprove && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Solicitudes del equipo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {teamRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sin solicitudes pendientes del equipo.
              </div>
            ) : (
              <div className="divide-y">
                {teamRequests.map((r) => (
                  <div key={r.id}>
                    <RequestRow req={r} showUser={true} canCancel={false} />
                    {r.status === "PENDING" && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        {decisionId === r.id ? (
                          <>
                            <input
                              type="text"
                              value={decisionNote}
                              onChange={(e) => setDecisionNote(e.target.value)}
                              placeholder="Nota opcional para el empleado"
                              className="flex-1 h-8 px-2 border rounded text-xs"
                            />
                            <Button size="sm" variant="outline" className="text-green-700 border-green-200"
                              onClick={() => decide("APPROVED", r.id)} disabled={pending}>
                              Aprobar
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-700 border-red-200"
                              onClick={() => decide("REJECTED", r.id)} disabled={pending}>
                              Rechazar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDecisionId(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setDecisionId(r.id)}>
                            Decidir
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">días</p>
    </div>
  );
}

function RequestRow({ req, showUser, canCancel, onCancel }: {
  req: Request; showUser: boolean; canCancel: boolean; onCancel?: () => void;
}) {
  const cfg = STATUS_CONFIG[req.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {showUser && <p className="text-sm font-medium">{req.userName}</p>}
          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[req.type]}</Badge>
          <span className="text-xs font-medium">{req.totalDays} día(s)</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          <Calendar className="w-3 h-3 inline mr-1" />
          {new Date(req.startDate).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          {" → "}
          {new Date(req.endDate).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {req.note && <p className="text-xs text-muted-foreground italic mt-1">{req.note}</p>}
        {req.decisionNote && (
          <p className="text-xs mt-1 px-2 py-1 bg-muted/40 rounded">
            <span className="font-medium">{req.decidedByName}:</span> {req.decisionNote}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
          <StatusIcon className="w-3 h-3 mr-0.5" />
          {cfg.label}
        </Badge>
        {canCancel && onCancel && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-600" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

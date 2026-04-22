import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { WorkDayStatus } from "@prisma/client";

type TeamMember = {
  userId: string;
  fullName: string;
  jobTitle: string | null;
  businessName: string;
};

type WorkDayRow = {
  userId: string;
  status: WorkDayStatus;
  totalMinutes: number;
  firstPunchTime: string | null; // "HH:MM"
  lastPunchTime: string | null;  // "HH:MM"
  isOnBreak: boolean;
};

type ScheduledShiftRow = {
  userId: string;
  startTime: string | null;
  endTime: string | null;
  role: string | null;
  status: "PLANNED" | "CONFIRMED" | "ABSENT" | "CANCELED";
};

type Props = {
  team: TeamMember[];
  workDays: WorkDayRow[];             // hoy
  scheduledShifts: ScheduledShiftRow[]; // hoy
  showBusinessName: boolean;
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function TeamPayrollPanel({
  team,
  workDays,
  scheduledShifts,
  showBusinessName,
}: Props) {
  const workDayByUser = new Map(workDays.map((w) => [w.userId, w]));
  const shiftByUser = new Map(scheduledShifts.map((s) => [s.userId, s]));

  // Categorizar
  const scheduledIds = new Set(scheduledShifts.filter((s) => s.status !== "CANCELED").map((s) => s.userId));
  const checkedInIds = new Set(workDays.map((w) => w.userId));

  const present: TeamMember[] = [];
  const absent: TeamMember[] = [];
  const unscheduled: TeamMember[] = [];

  for (const m of team) {
    const isScheduled = scheduledIds.has(m.userId);
    const isCheckedIn = checkedInIds.has(m.userId);

    if (isScheduled && isCheckedIn) present.push(m);
    else if (isScheduled && !isCheckedIn) absent.push(m);
    else if (!isScheduled && isCheckedIn) present.push(m); // checó sin estar programado — cuenta como presente
    else unscheduled.push(m);
  }

  // Total minutos trabajados hoy por el equipo
  const totalMinutes = workDays.reduce((sum, w) => sum + w.totalMinutes, 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Equipo</CardTitle>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{team.length}</div>
            <p className="text-xs text-muted-foreground">Empleados activos</p>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Presentes</CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold text-green-600">{present.length}</div>
            <p className="text-xs text-muted-foreground">Checaron hoy</p>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ausentes</CardTitle>
            <XCircle className={`h-3.5 w-3.5 ${absent.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold ${absent.length > 0 ? "text-red-600" : ""}`}>
              {absent.length}
            </div>
            <p className="text-xs text-muted-foreground">Programados sin checar</p>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Hrs trabajadas hoy</CardTitle>
            <Clock className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{formatMinutes(totalMinutes)}</div>
            <p className="text-xs text-muted-foreground">Total equipo</p>
          </CardContent>
        </Card>
      </div>

      {/* Presentes */}
      {present.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Trabajando hoy ({present.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {present.map((m) => {
                const wd = workDayByUser.get(m.userId);
                const shift = shiftByUser.get(m.userId);
                return (
                  <div key={m.userId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar name={m.fullName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {shift?.role ?? m.jobTitle ?? "Sin rol asignado"}
                          {showBusinessName && ` · ${m.businessName}`}
                          {shift?.startTime && ` · Turno ${shift.startTime}`}
                          {shift?.endTime && `–${shift.endTime}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {wd?.isOnBreak && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                          En pausa
                        </Badge>
                      )}
                      {wd && wd.totalMinutes > 0 && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatMinutes(wd.totalMinutes)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                        Presente
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ausentes (programados que no checaron) */}
      {absent.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Programados sin checar ({absent.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {absent.map((m) => {
                const shift = shiftByUser.get(m.userId);
                return (
                  <div key={m.userId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar name={m.fullName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {shift?.role ?? m.jobTitle ?? "Sin rol"}
                          {shift?.startTime && ` · Debía entrar ${shift.startTime}`}
                          {showBusinessName && ` · ${m.businessName}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0">
                      <XCircle className="w-3 h-3 mr-0.5" />
                      Sin checar
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No programados hoy (descanso) */}
      {unscheduled.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sin turno hoy ({unscheduled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {unscheduled.slice(0, 10).map((m) => (
                <div key={m.userId} className="px-4 py-2 flex items-center gap-3">
                  <Avatar name={m.fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.jobTitle ?? "Sin rol"}
                      {showBusinessName && ` · ${m.businessName}`}
                    </p>
                  </div>
                </div>
              ))}
              {unscheduled.length > 10 && (
                <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                  ...y {unscheduled.length - 10} más
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {team.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tienes empleados asignados a tus negocios.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  const cls = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div className={`${cls} rounded-full bg-muted flex items-center justify-center shrink-0 font-semibold`}>
      {initials}
    </div>
  );
}

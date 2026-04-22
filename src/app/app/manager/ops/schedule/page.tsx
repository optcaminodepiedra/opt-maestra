import { redirect } from "next/navigation";
import { resolveManagerScope } from "@/lib/manager-scope";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import {
  currentWeekMondayIso,
  isoDate,
  dateOnly,
  getShiftsForWeek,
  getCandidateUsersForBusiness,
} from "@/lib/schedule";
import { WeekScheduleClient } from "@/components/manager/WeekScheduleClient";

export const dynamic = "force-dynamic";

function addDaysIso(iso: string, days: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; week?: string }>;
}) {
  const scope = await resolveManagerScope("ops");
  const sp = await searchParams;

  if (scope.businesses.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin negocios asignados</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne un negocio.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedBusinessId = sp.businessId ?? scope.businesses[0].id;
  if (!scope.businessIds.includes(selectedBusinessId)) {
    redirect(`/app/manager/ops/schedule?businessId=${scope.businesses[0].id}`);
  }

  const weekStart = sp.week ?? currentWeekMondayIso();

  const [business, shifts, candidates] = await Promise.all([
    prisma.business.findUnique({
      where: { id: selectedBusinessId },
      select: { id: true, name: true },
    }),
    getShiftsForWeek(selectedBusinessId, weekStart),
    getCandidateUsersForBusiness(selectedBusinessId),
  ]);

  if (!business) redirect("/app");

  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeek = addDaysIso(weekStart, 7);
  const currentWeek = currentWeekMondayIso();

  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const weekEnd = addDaysIso(weekStart, 6);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/manager/ops">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Calendar className="w-6 h-6" /> Plantilla semanal
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{business.name}</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {scope.businesses.map((b) => (
            <Link key={b.id} href={`/app/manager/ops/schedule?businessId=${b.id}&week=${weekStart}`}>
              <Badge variant={b.id === selectedBusinessId ? "default" : "outline"} className="cursor-pointer hover:opacity-80">
                {b.name}
              </Badge>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/manager/ops/schedule?businessId=${selectedBusinessId}&week=${prevWeek}`}>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="text-sm font-medium min-w-[180px] text-center">
            {dateOnly(weekStart).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            {" – "}
            {dateOnly(weekEnd).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/manager/ops/schedule?businessId=${selectedBusinessId}&week=${nextWeek}`}>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
          {weekStart !== currentWeek && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/app/manager/ops/schedule?businessId=${selectedBusinessId}&week=${currentWeek}`}>
                Semana actual
              </Link>
            </Button>
          )}
        </div>
      </div>

      <WeekScheduleClient
        businessId={selectedBusinessId}
        weekStartIso={weekStart}
        days={days}
        shifts={shifts.map((s: any) => ({
          id: s.id,
          userId: s.userId,
          userName: s.user.fullName,
          jobTitle: s.user.jobTitle,
          dateIso: isoDate(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          role: s.role,
          note: s.note,
          status: s.status,
        }))}
        candidates={candidates.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          username: c.username,
          jobTitle: c.jobTitle,
          role: c.role as string,
        }))}
      />

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {shifts.length} turno(s) programados · {new Set(shifts.map((s: any) => s.userId)).size} empleado(s) distintos
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

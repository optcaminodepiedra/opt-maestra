import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
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

/* ─── Resuelve negocios del usuario actual ─── */
async function getManagedBusinessIds(userId: string, primaryBusinessId: string | null): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<{ businessId: string }[]>`
      SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
    `;
    if (rows.length > 0) {
      const ids = rows.map((r) => r.businessId);
      if (primaryBusinessId && !ids.includes(primaryBusinessId)) ids.push(primaryBusinessId);
      return ids;
    }
  } catch {}
  return primaryBusinessId ? [primaryBusinessId] : [];
}

function addDaysIso(iso: string, days: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export default async function ScheduleWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; week?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as { id?: string; name?: string; role?: string; primaryBusinessId?: string | null };
  const sp = await searchParams;

  // Control de acceso básico: solo managers
  const role = u.role as string;
  const allowedRoles = [
    "MASTER_ADMIN", "OWNER", "SUPERIOR",
    "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER",
  ];
  if (!allowedRoles.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para gestionar plantillas de trabajo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const managed = await getManagedBusinessIds(u.id ?? "", u.primaryBusinessId ?? null);

  // Si es dirección (sin primary), permitimos gestionar cualquier negocio
  const isGlobal = ["MASTER_ADMIN", "OWNER", "SUPERIOR"].includes(role);
  const allBusinessIds = isGlobal
    ? (await prisma.business.findMany({ select: { id: true } })).map((b) => b.id)
    : managed;

  if (allBusinessIds.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin negocios asignados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne al menos un negocio para poder programar turnos.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedBusinessId = sp.businessId ?? allBusinessIds[0];
  if (!allBusinessIds.includes(selectedBusinessId)) {
    redirect(`/app/manager/schedule?businessId=${allBusinessIds[0]}`);
  }

  const weekStart = sp.week ?? currentWeekMondayIso();

  const [business, allBusinesses, shifts, candidates] = await Promise.all([
    prisma.business.findUnique({
      where: { id: selectedBusinessId },
      select: { id: true, name: true },
    }),
    prisma.business.findMany({
      where: { id: { in: allBusinessIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getShiftsForWeek(selectedBusinessId, weekStart),
    getCandidateUsersForBusiness(selectedBusinessId),
  ]);

  if (!business) redirect("/app/manager/schedule");

  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeek = addDaysIso(weekStart, 7);
  const currentWeek = currentWeekMondayIso();

  // Arrays de 7 días
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(weekStart, i);
    const date = dateOnly(iso);
    return { iso, date };
  });

  const weekEnd = addDaysIso(weekStart, 6);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app">
                <ArrowLeft className="w-4 h-4 mr-1" /> Volver
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
            <Calendar className="w-6 h-6" /> Plantilla semanal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {business.name}
          </p>
        </div>
      </div>

      {/* Controles: negocio + navegación de semana */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {allBusinesses.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {allBusinesses.map((b) => (
                <Link
                  key={b.id}
                  href={`/app/manager/schedule?businessId=${b.id}&week=${weekStart}`}
                >
                  <Badge
                    variant={b.id === selectedBusinessId ? "default" : "outline"}
                    className="cursor-pointer hover:opacity-80"
                  >
                    {b.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/manager/schedule?businessId=${selectedBusinessId}&week=${prevWeek}`}>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="text-sm font-medium min-w-[180px] text-center">
            {dateOnly(weekStart).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            {" – "}
            {dateOnly(weekEnd).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/manager/schedule?businessId=${selectedBusinessId}&week=${nextWeek}`}>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
          {weekStart !== currentWeek && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/app/manager/schedule?businessId=${selectedBusinessId}&week=${currentWeek}`}>
                Semana actual
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabla semanal */}
      <WeekScheduleClient
        businessId={selectedBusinessId}
        weekStartIso={weekStart}
        days={days.map((d) => d.iso)}
        shifts={shifts.map((s) => ({
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
          role: c.role,
        }))}
      />

      {/* Info: total semana */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {shifts.length} turno(s) programados en la semana ·{" "}
              {new Set(shifts.map((s) => s.userId)).size} empleado(s) distintos
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

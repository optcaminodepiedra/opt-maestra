import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { VacationsClient } from "@/components/vacations/VacationsClient";
import { getOrCreateBalance } from "@/lib/vacations.actions";

export const dynamic = "force-dynamic";

const APPROVER_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING",
  "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER",
];

const GLOBAL_APPROVERS = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];

export default async function VacationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const userId = me.id!;
  const role = me.role as string;
  const canApprove = APPROVER_ROLES.includes(role);
  const isGlobalApprover = GLOBAL_APPROVERS.includes(role);

  const currentYear = new Date().getFullYear();
  const balance = await getOrCreateBalance(userId, currentYear);

  // Mis solicitudes
  const myRequestsRaw = await prisma.vacationRequest.findMany({
    where: { userId },
    include: {
      decidedBy: { select: { fullName: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Del equipo (solo si puede aprobar)
  let teamRequestsRaw: typeof myRequestsRaw = [];
  if (canApprove) {
    if (isGlobalApprover) {
      // MASTER_ADMIN / OWNER / SUPERIOR / ACCOUNTING ven TODAS las solicitudes de todos los usuarios (excepto las propias)
      teamRequestsRaw = await prisma.vacationRequest.findMany({
        where: { userId: { not: userId } },
        include: {
          decidedBy: { select: { fullName: true } },
          user: { select: { fullName: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
    } else {
      // Manager: solo su equipo
      const primaryId = me.primaryBusinessId;
      const businessIds: string[] = primaryId ? [primaryId] : [];
      try {
        const access = await prisma.$queryRaw<{ businessId: string }[]>`
          SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
        `;
        for (const a of access) {
          if (!businessIds.includes(a.businessId)) businessIds.push(a.businessId);
        }
      } catch {}

      if (businessIds.length > 0) {
        const teamUsers = await prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: userId },
            OR: [
              { businessId: { in: businessIds } },
              { primaryBusinessId: { in: businessIds } },
              { businessAccess: { some: { businessId: { in: businessIds } } } },
            ],
          },
          select: { id: true },
        });
        const teamIds = teamUsers.map((u) => u.id);
        if (teamIds.length > 0) {
          teamRequestsRaw = await prisma.vacationRequest.findMany({
            where: { userId: { in: teamIds } },
            include: {
              decidedBy: { select: { fullName: true } },
              user: { select: { fullName: true } },
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            take: 100,
          });
        }
      }
    }
  }

  const serialize = (r: typeof myRequestsRaw[0]) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.fullName,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    totalDays: r.totalDays,
    type: r.type,
    status: r.status,
    note: r.note,
    decidedByName: r.decidedBy?.fullName ?? null,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
  });

  // Contar pendientes para mostrar en el título si hay
  const pendingCount = teamRequestsRaw.filter((r) => r.status === "PENDING").length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calendar className="w-7 h-7 text-indigo-500" /> Vacaciones
          {pendingCount > 0 && canApprove && (
            <span className="text-xs font-normal bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 ml-2">
              {pendingCount} pendientes
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canApprove
            ? "Gestiona tus solicitudes y aprueba las de tu equipo"
            : "Gestiona tus solicitudes de vacaciones, permisos e incapacidades"}
        </p>
      </div>

      <VacationsClient
        balance={balance}
        myRequests={myRequestsRaw.map(serialize)}
        teamRequests={teamRequestsRaw.map(serialize)}
        canApprove={canApprove}
        viewerUserId={userId}
      />
    </div>
  );
}

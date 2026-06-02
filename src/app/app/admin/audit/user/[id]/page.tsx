import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { getUserAuditDetail } from "@/lib/audit-queries";
import UserDetailClient from "./UserDetailClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function UserAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Acceso restringido
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;

  // Resolver rango de fechas (default: últimos 30 días)
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(now.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = sp.from ? new Date(sp.from + "T00:00:00") : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : new Date(now);

  const filters = {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    preset: sp.preset ?? "last30days",
  };

  // Buscar info del usuario
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, fullName: true, role: true, email: true,
      primaryBusinessId: true, isActive: true, createdAt: true,
    },
  });
  if (!user) notFound();

  const [businesses, detail] = await Promise.all([
    prisma.business.findMany({ select: { id: true, name: true } }),
    getUserAuditDetail(id, filters),
  ]);

  const businessMap = Object.fromEntries(businesses.map((b: { id: string; name: string }) => [b.id, b.name]));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
        <Link href="/app/admin/audit">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al historial general
        </Link>
      </Button>

      <UserDetailClient
        user={{
          id: user.id,
          username: user.username ?? user.id,
          fullName: user.fullName ?? user.username ?? "Sin nombre",
          role: user.role ?? "Sin rol",
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
        }}
        filters={filters}
        detail={detail}
        businessMap={businessMap}
      />
    </div>
  );
}

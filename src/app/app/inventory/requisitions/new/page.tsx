import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import Link from "next/link";
import { NewRequisitionClient } from "@/components/inventory/NewRequisitionClient";
import { getInventoryItemsForBusiness } from "@/lib/requisitions.actions";

export const dynamic = "force-dynamic";

async function getManagedBusinessIds(
  userId: string,
  primaryBusinessId: string | null
): Promise<string[]> {
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

export default async function NewRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const u = session.user as {
    id?: string;
    role?: string;
    primaryBusinessId?: string | null;
  };
  const sp = await searchParams;
  const role = u.role as string;

  // Permisos
  const allowedRoles = [
    "MASTER_ADMIN", "OWNER", "SUPERIOR",
    "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH",
    "MANAGER", "INVENTORY",
  ];
  if (!allowedRoles.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para crear requisiciones.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Resolver negocios donde puede crear requisiciones
  const isGlobal = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY"].includes(role);
  const candidateIds = isGlobal
    ? (await prisma.business.findMany({ select: { id: true } })).map((b) => b.id)
    : await getManagedBusinessIds(u.id ?? "", u.primaryBusinessId ?? null);

  if (candidateIds.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin negocios asignados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pide a un administrador que te asigne al menos un negocio.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedBusinessId = sp.businessId ?? candidateIds[0];
  if (!candidateIds.includes(selectedBusinessId)) {
    redirect(`/app/inventory/requisitions/new?businessId=${candidateIds[0]}`);
  }

  const [businesses, items] = await Promise.all([
    prisma.business.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getInventoryItemsForBusiness(selectedBusinessId),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/inventory/requisitions">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-7 h-7 text-blue-500" /> Nueva requisición
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Solicita productos al almacén general para tu negocio
        </p>
      </div>

      <NewRequisitionClient
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        items={items}
      />
    </div>
  );
}

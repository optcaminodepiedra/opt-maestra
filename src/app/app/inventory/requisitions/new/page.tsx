import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewRequisitionWizard } from "@/components/inventory/NewRequisitionWizard";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR",
  "INVENTORY",
  "MANAGER", "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH",
];

export default async function NewRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; kind?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const me = session.user as { id?: string; role?: string; primaryBusinessId?: string | null };
  const role = me.role as string;

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin permisos</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No tienes permisos para crear requisiciones.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;

  // Determinar negocios visibles según rol
  const isAdmin = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY"].includes(role);

  let businesses: { id: string; name: string }[];

  if (isAdmin) {
    businesses = await prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    // Manager: solo su negocio principal + los que tenga acceso vía UserBusinessAccess
    const userId = me.id!;
    const businessIds: string[] = me.primaryBusinessId ? [me.primaryBusinessId] : [];
    try {
      const access = await prisma.$queryRaw<{ businessId: string }[]>`
        SELECT "businessId" FROM "UserBusinessAccess" WHERE "userId" = ${userId}
      `;
      for (const a of access) {
        if (!businessIds.includes(a.businessId)) businessIds.push(a.businessId);
      }
    } catch {}

    if (businessIds.length === 0) {
      return (
        <div className="p-6 max-w-xl mx-auto">
          <Card>
            <CardHeader><CardTitle>Sin negocio asignado</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No tienes un negocio principal asignado. Contacta a tu administrador.
            </CardContent>
          </Card>
        </div>
      );
    }

    businesses = await prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // Determinar negocio seleccionado
  const selectedBusinessId =
    sp.businessId && businesses.some((b) => b.id === sp.businessId)
      ? sp.businessId
      : businesses[0]?.id ?? null;

  // Cargar items del catálogo del negocio seleccionado
  let items: any[] = [];
  if (selectedBusinessId) {
    items = await prisma.inventoryItem.findMany({
      where: { businessId: selectedBusinessId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        onHandQty: true,
        minQty: true,
        lastPriceCents: true,
        supplierName: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  // Validar que el initialKind sea uno de los permitidos
  const validKinds = ["RESTAURANT", "SPECIAL_EVENT", "OWNER_HOUSE", "VENDING_MACHINE"];
  const initialKind = sp.kind && validKinds.includes(sp.kind) ? sp.kind : undefined;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/inventory">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Plus className="w-7 h-7 text-blue-500" />
          Nueva requisición
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Solicita productos al almacén
        </p>
      </div>

      <NewRequisitionWizard
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        items={items.map((i) => ({
          ...i,
          unit: String(i.unit),
        }))}
        userRole={role}
        initialKind={initialKind as any}
      />
    </div>
  );
}

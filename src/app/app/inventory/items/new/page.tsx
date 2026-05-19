import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import NewItemForm from "./NewItemForm";
import { ALMACEN_GENERAL_ID, ALMACEN_GENERAL_NAME } from "@/lib/inventory-constants";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY",
  "MANAGER_OPS", "MANAGER", "MANAGER_HOTEL",
];

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sin permisos para crear productos en el catálogo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const requestedBusinessId = sp.businessId ?? ALMACEN_GENERAL_ID;

  // Resolver nombre del negocio
  let businessName = ALMACEN_GENERAL_NAME;
  if (requestedBusinessId !== ALMACEN_GENERAL_ID) {
    const biz = await prisma.business.findUnique({
      where: { id: requestedBusinessId },
      select: { name: true },
    });
    if (!biz) {
      return (
        <div className="p-6 max-w-xl mx-auto">
          <Card>
            <CardHeader><CardTitle>Negocio no encontrado</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              El identificador de negocio no es válido.
            </CardContent>
          </Card>
        </div>
      );
    }
    businessName = biz.name;
  }

  // Lista de negocios para que el usuario pueda cambiar destino si tiene permisos
  const isGlobal = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY"].includes(role);
  const allBusinesses = isGlobal
    ? await prisma.business.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/app/inventory/stock?businessId=${requestedBusinessId}`}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al stock
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <PackagePlus className="w-7 h-7 text-primary" />
          Nuevo producto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Se guardará en: <strong>{businessName}</strong>
        </p>
      </div>

      <NewItemForm
        businessId={requestedBusinessId}
        businessName={businessName}
        allBusinesses={allBusinesses}
        isGlobal={isGlobal}
      />
    </div>
  );
}

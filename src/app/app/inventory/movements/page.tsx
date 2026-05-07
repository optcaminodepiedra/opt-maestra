import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { listInventoryMovements } from "@/lib/inventory.actions";
import { ALMACEN_GENERAL_ID, ALMACEN_GENERAL_NAME } from "@/lib/inventory-constants";
import { MovementsClient } from "@/components/inventory/MovementsClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY", "ACCOUNTING"];

export default async function MovementsPage({
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
            No tienes permisos para ver el historial de movimientos.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = sp.businessId ?? ALMACEN_GENERAL_ID;

  let businessName = ALMACEN_GENERAL_NAME;
  if (businessId !== ALMACEN_GENERAL_ID) {
    const { prisma } = await import("@/lib/prisma");
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    businessName = biz?.name ?? "—";
  }

  let moves: any[] = [];
  try {
    moves = await listInventoryMovements({ businessId, limit: 200 });
  } catch (err: any) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{err.message}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/app/inventory/stock?businessId=${businessId}`}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al stock
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-blue-500" />
          Historial de movimientos — {businessName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entradas, salidas, ajustes y transferencias de inventario
        </p>
      </div>

      <MovementsClient moves={moves} />
    </div>
  );
}

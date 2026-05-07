import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Boxes, History, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getStockSummary, getDestinationBusinesses } from "@/lib/inventory.actions";
import { ALMACEN_GENERAL_ID, ALMACEN_GENERAL_NAME } from "@/lib/inventory-constants";
import { StockClient } from "@/components/inventory/StockClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY", "ACCOUNTING"];

export default async function StockPage({
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
            Solo el almacén central, contabilidad y dirección pueden ver el stock global.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const businessId = sp.businessId ?? ALMACEN_GENERAL_ID;

  let data;
  try {
    data = await getStockSummary(businessId);
  } catch (err: any) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Error al cargar inventario</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {err.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determinar nombre del negocio
  let businessName = ALMACEN_GENERAL_NAME;
  if (businessId !== ALMACEN_GENERAL_ID) {
    const { prisma } = await import("@/lib/prisma");
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    businessName = biz?.name ?? "—";
  }

  const destinationBusinesses = await getDestinationBusinesses(businessId);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/inventory">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al panel
        </Link>
      </Button>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Boxes className="w-7 h-7 text-blue-500" />
            Stock físico — {businessName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inventario actual con valor, alertas y movimientos manuales
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/inventory/movements?businessId=${businessId}`}>
              <History className="w-4 h-4 mr-1.5" /> Historial de movimientos
            </Link>
          </Button>
        </div>
      </div>

      <StockClient
        items={data.items}
        summary={data.summary}
        categories={data.categories}
        businessId={businessId}
        businessName={businessName}
        destinationBusinesses={destinationBusinesses}
      />
    </div>
  );
}

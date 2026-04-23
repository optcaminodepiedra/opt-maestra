import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, History } from "lucide-react";
import Link from "next/link";
import { ImportWizard } from "@/components/admin/ImportWizard";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function AdminImportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores pueden importar data histórica.
          </CardContent>
        </Card>
      </div>
    );
  }

  const businesses = await prisma.business.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="w-7 h-7 text-indigo-500" />
            Importar data histórica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sube CSV o Excel para poblar ventas, gastos, reservaciones, inventario y más
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/admin/import/history">
            <History className="w-4 h-4 mr-1.5" /> Historial
          </Link>
        </Button>
      </div>

      <ImportWizard businesses={businesses} />
    </div>
  );
}

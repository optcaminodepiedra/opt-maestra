import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, History, FileCode, ArrowRight } from "lucide-react";
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
            Sube CSV, Excel o XML para poblar ventas, gastos, reservaciones, inventario y más
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/admin/import/history">
            <History className="w-4 h-4 mr-1.5" /> Historial
          </Link>
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          NUEVA TARJETA: Import XML SoftRestaurant (Fase 8F)
          ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-xl shrink-0">
            <FileCode className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-base">
                Importar XMLs de SoftRestaurant
              </h3>
              <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                Nuevo
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Sube respaldos en formato XML (cheques, gastos, turnos, etc.) con un solo click.
              Detecta el tipo automáticamente, previene duplicados por folio, y soporta archivos grandes hasta ~50MB.
            </p>
            <Button asChild>
              <Link href="/app/admin/import/xml">
                Ir a importar XML <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          Wizard original (CSV / Excel)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Importar desde CSV o Excel
        </h2>
        <ImportWizard businesses={businesses} />
      </div>
    </div>
  );
}

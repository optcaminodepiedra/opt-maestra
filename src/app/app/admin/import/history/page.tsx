import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { getImportBatches } from "@/lib/import.actions";
import { HistoryClient } from "@/components/admin/HistoryClient";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export default async function AdminImportHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo administradores pueden ver el historial de importaciones.
          </CardContent>
        </Card>
      </div>
    );
  }

  const batches = await getImportBatches(100);

  const serialized = batches.map((b) => ({
    id: b.id,
    entityType: b.entityType,
    businessName: b.business?.name ?? null,
    filename: b.filename,
    totalRows: b.totalRows,
    successRows: b.successRows,
    errorRows: b.errorRows,
    status: b.status,
    note: b.note,
    createdByName: b.createdBy?.fullName ?? "?",
    revertedByName: b.revertedBy?.fullName ?? null,
    createdAt: b.createdAt.toISOString(),
    revertedAt: b.revertedAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/admin/import">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-7 h-7 text-indigo-500" />
          Historial de importaciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revisa o deshace importaciones anteriores
        </p>
      </div>

      <HistoryClient batches={serialized} />
    </div>
  );
}

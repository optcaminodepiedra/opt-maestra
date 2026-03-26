import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import RequisitionsTable from "./RequisitionsTable";

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traemos las requisiciones que están esperando aprobación o ya aprobadas
  const requisitions = await prisma.requisition.findMany({
    where: {
      status: { in: ["SUBMITTED", "APPROVED"] }
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { fullName: true } },
      items: {
        include: { item: true }
      }
    }
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/app/inventory"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Autorización de Compras</h1>
            <p className="text-muted-foreground mt-1">
              Revisa y aprueba las solicitudes de resurtido de las áreas.
            </p>
          </div>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" asChild>
            <Link href="/app/inventory/requisitions/print">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Generar Lista Imprimible
            </Link>
        </Button>
      </div>

      {/* Pasamos los datos a la tabla interactiva */}
      <RequisitionsTable data={requisitions} userId={session.user.id} />
    </div>
  );
}
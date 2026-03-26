import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import MovementForm from "./MovementForm";

export default async function MovementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Buscamos el negocio
  const business = await prisma.business.findFirst();
  if (!business) {
    return <div className="p-12 text-center text-red-500">Error de sucursal.</div>;
  }

  // Traemos el catálogo de productos ordenado alfabéticamente
  const items = await prisma.inventoryItem.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, onHandQty: true }
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" asChild>
          <Link href="/app/inventory"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="w-8 h-8 text-primary" />
            Entradas y Salidas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registra llegada de proveedores, mermas o traspasos a otras áreas.
          </p>
        </div>
      </div>

      <MovementForm businessId={business.id} userId={session.user.id} items={items} />
    </div>
  );
}
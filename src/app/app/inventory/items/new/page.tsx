import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import NewItemForm from "./NewItemForm";

export default async function NewItemPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Buscamos el negocio principal del usuario (ej. Bodega 4)
  const business = await prisma.business.findFirst();
  if (!business) {
    return <div className="p-12 text-center text-red-500">Error: No se encontró la sucursal o negocio.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" asChild>
          <Link href="/app/inventory"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PackagePlus className="w-8 h-8 text-primary" />
            Alta de Producto
          </h1>
          <p className="text-muted-foreground mt-1">
            Registra un nuevo artículo en el catálogo para poder darle entrada al almacén.
          </p>
        </div>
      </div>

      {/* Cargamos el formulario interactivo */}
      <NewItemForm businessId={business.id} />
    </div>
  );
}
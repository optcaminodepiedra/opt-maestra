import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PencilLine } from "lucide-react";
import Link from "next/link";
import { getInventoryItem } from "@/lib/inventory.actions";
import EditItemForm from "./EditItemForm";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = [
  "MASTER_ADMIN", "OWNER", "SUPERIOR", "INVENTORY",
  "MANAGER_OPS", "MANAGER", "MANAGER_HOTEL",
];

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
            Sin permisos para editar productos del catálogo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { id } = await params;

  let item;
  try {
    item = await getInventoryItem(id);
  } catch (err: any) {
    if (err.message?.includes("no encontrado")) notFound();
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {err.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/app/inventory/stock?businessId=${item.businessId}`}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver al stock
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <PencilLine className="w-7 h-7 text-amber-500" />
          Editar producto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {item.name}
          {item.sku && <span className="ml-2 text-xs">SKU: {item.sku}</span>}
        </p>
      </div>

      <EditItemForm item={item} />
    </div>
  );
}

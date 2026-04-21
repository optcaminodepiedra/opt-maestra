import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingBag className="w-7 h-7 text-purple-500" /> Tienda
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tienda Casa de los Lamentos
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Construction className="w-5 h-5 text-amber-500" /> Módulo en construcción
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Pronto tendrás un POS especializado para la tienda con control de torniquete, catálogo
            de productos y reportes de ventas.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Lo que vendrá</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>POS simple de mostrador</li>
                <li>Control de torniquete (entradas a museo)</li>
                <li>Inventario de mercancía</li>
                <li>Reportes de ventas y cortes</li>
              </ul>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Mientras tanto</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>
                  Ve el{" "}
                  <Link href="/app/inventory" className="underline">
                    inventario general
                  </Link>
                </li>
                <li>
                  Registra ventas en{" "}
                  <Link href="/app/accounting" className="underline">
                    contabilidad
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bath, Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BathroomsPage() {
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
          <Bath className="w-7 h-7 text-sky-500" /> Baños públicos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control de limpieza, insumos y cobros de baños de la operadora
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
            Pronto tendrás control de cobros por uso, registro de limpieza periódica y alertas de
            insumos (papel, jabón, desinfectante).
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Lo que vendrá</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Registro de cobros por uso</li>
                <li>Bitácora de limpieza</li>
                <li>Alertas de insumos bajos</li>
                <li>Reportes por ubicación</li>
              </ul>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Mientras tanto</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>
                  Solicita insumos desde{" "}
                  <Link href="/app/inventory/requisitions" className="underline">
                    Requisiciones
                  </Link>
                </li>
                <li>
                  Registra tareas de limpieza en{" "}
                  <Link href="/app/ops/kanban/activities" className="underline">
                    Tablero
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

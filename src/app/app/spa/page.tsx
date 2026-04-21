import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flower2, Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SpaPage() {
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
          <Flower2 className="w-7 h-7 text-pink-500" /> Spa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tierra Adentro Hotel Fashion Grill & Spa
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
            Pronto podrás gestionar desde aquí las citas, tratamientos, terapeutas y reportes del
            spa.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Lo que vendrá</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Agenda de citas y calendario</li>
                <li>Catálogo de tratamientos y precios</li>
                <li>Terapeutas y horarios</li>
                <li>Reportes de ingresos y comisiones</li>
              </ul>
            </div>
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground mb-1">Mientras tanto</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>
                  Registra ingresos como ventas en{" "}
                  <Link href="/app/restaurant/pos" className="underline">
                    POS
                  </Link>
                </li>
                <li>
                  Gastos del spa en{" "}
                  <Link href="/app/manager/expenses/new" className="underline">
                    nuevo gasto
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

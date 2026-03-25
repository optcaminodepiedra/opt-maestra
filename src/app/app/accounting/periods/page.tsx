import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import PeriodsTable from "./PeriodsTable";

export default async function PeriodsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const currentYear = new Date().getFullYear();

  // Buscamos los meses que ya tengan algún estado en la base de datos
  const dbPeriods = await prisma.accountingPeriod.findMany({
    where: { year: currentYear }
  });

  // Generamos los 12 meses del año
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  const allMonths = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const dbRecord = dbPeriods.find(p => p.month === monthNum);
    
    return {
      month: monthNum,
      name: name,
      year: currentYear,
      isClosed: dbRecord?.isClosed || false,
      closedAt: dbRecord?.closedAt,
      closedBy: dbRecord?.closedByRef
    };
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" asChild>
          <Link href="/app/accounting"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cierre de Periodos {currentYear}</h1>
          <p className="text-muted-foreground mt-1">
            Bloquea meses pasados para evitar modificaciones o registros fuera de tiempo.
          </p>
        </div>
      </div>

      <PeriodsTable 
        months={allMonths} 
        userName={session.user.name || "Admin"} 
      />
    </div>
  );
}
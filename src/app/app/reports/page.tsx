import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { loadGlobalReport } from "@/lib/global-reports";
import { GlobalReportClient } from "@/components/admin/GlobalReportClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default async function GlobalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
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
            Solo dirección y contabilidad pueden ver reportes globales.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const now = new Date();
  const year = parseInt(sp.y ?? String(now.getFullYear()), 10);
  const month = parseInt(sp.m ?? String(now.getMonth() + 1), 10);

  const data = await loadGlobalReport(year, month);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-7 h-7 text-indigo-500" />
          Reportes globales
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consolidado financiero de todos los negocios
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/reports?y=${prev.y}&m=${prev.m}`}>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="text-lg font-bold min-w-[200px] text-center">
          {MONTHS[month - 1]} {year}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/reports?y=${next.y}&m=${next.m}`}>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <GlobalReportClient data={data} year={year} month={month} />
    </div>
  );
}

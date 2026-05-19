import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FileText, ArrowLeft, Building2, LayoutDashboard, DollarSign,
  TrendingUp, Clock, CalendarDays, Trophy, Package, ArrowRight, Sparkles,
} from "lucide-react";

import { resolveManagerScope } from "@/lib/manager-scope";
import { resolveAnalyticsFilters } from "@/lib/analytics-filters";
import {
  getKpisWithDelta, getSalesTimeSeries, getSalesByMethod,
} from "@/lib/analytics";
import {
  getSalesByWeekday, getSalesByHour, getBusinessComparison,
} from "@/lib/analytics-reports";
import { suggestGranularity } from "@/lib/date-presets";

import { AnalyticsToolbar } from "@/components/analytics/AnalyticsToolbar";
import { KpiCard } from "@/components/analytics/KpiCard";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { DistributionDonut } from "@/components/analytics/DistributionDonut";
import { ComparisonBarChart } from "@/components/analytics/ComparisonBarChart";
import { ExportMenu } from "@/components/analytics/ExportMenu";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtNum = (n: number) => new Intl.NumberFormat("es-MX").format(n);

export default async function ManagerReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const scope = await resolveManagerScope("ops");

  if (scope.businesses.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Sin negocios asignados</CardTitle></CardHeader>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const filters = resolveAnalyticsFilters(sp, scope.businessIds);
  const businessesMap = new Map(scope.businesses.map((b) => [b.id, b.name]));
  const granularity = suggestGranularity(filters.range);

  const [
    kpis, salesSeries, salesSeriesComp,
    byMethod, byWeekday, byHour, byBusiness,
  ] = await Promise.all([
    getKpisWithDelta(filters.selectedBusinessIds, filters.range, filters.comparisonRange),
    getSalesTimeSeries(filters.selectedBusinessIds, filters.range, granularity),
    filters.comparisonRange
      ? getSalesTimeSeries(filters.selectedBusinessIds, filters.comparisonRange, granularity)
      : Promise.resolve([]),
    getSalesByMethod(filters.selectedBusinessIds, filters.range),
    getSalesByWeekday(filters.selectedBusinessIds, filters.range),
    getSalesByHour(filters.selectedBusinessIds, filters.range),
    getBusinessComparison(filters.selectedBusinessIds, businessesMap, filters.range, filters.comparisonRange),
  ]);

  const mergedComp = filters.comparisonRange
    ? salesSeries.map((_, i) => ({
        label: salesSeriesComp[i]?.label ?? "", value: salesSeriesComp[i]?.value ?? 0,
      }))
    : undefined;

  // Detectar mejor día de la semana
  const bestWeekday = byWeekday.length > 0
    ? byWeekday.reduce((max, d) => (d.value > max.value ? d : max))
    : null;

  // Detectar hora pico
  const bestHour = byHour.length > 0
    ? byHour.reduce((max, h) => (h.value > max.value ? h : max))
    : null;

  // Solo mostrar gráfica de hora si hay actividad significativa
  const hasHourlyData = byHour.some((h) => h.value > 0);

  // Construir querystring para pasar filtros al reporte profundo
  const deepReportQs = new URLSearchParams();
  if (filters.selectedBusinessIdsFromUrl?.length === 1) {
    deepReportQs.set("businessId", filters.selectedBusinessIdsFromUrl[0]);
  } else if (scope.businesses.length === 1) {
    deepReportQs.set("businessId", scope.businesses[0].id);
  }
  if (filters.range.from) deepReportQs.set("from", filters.range.from.toISOString().slice(0, 10));
  if (filters.range.to) deepReportQs.set("to", filters.range.to.toISOString().slice(0, 10));
  const deepReportHref = `/app/manager/ops/products-report${deepReportQs.toString() ? `?${deepReportQs.toString()}` : ""}`;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
            <Link href="/app/manager/ops">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al panel
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-500" />
            Reportes y análisis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Patrones, comparativos y tendencias profundas
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ops">
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ops/finances">
              <DollarSign className="w-4 h-4 mr-1.5" /> Finanzas
            </Link>
          </Button>
          <Button size="sm" asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href={deepReportHref}>
              <Package className="w-4 h-4 mr-1.5" /> Reporte de productos
            </Link>
          </Button>
        </div>
      </div>

      {/* 🆕 Card destacado: acceso al reporte profundo de productos */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-indigo-50/40 to-transparent hover:shadow-md transition-shadow">
        <CardContent className="p-4 md:p-5">
          <Link href={deepReportHref} className="block group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base md:text-lg font-bold">
                    Reporte profundo de productos
                  </h3>
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 text-[10px]">
                    <Sparkles className="w-2.5 h-2.5 mr-1" />
                    Nuevo
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Top productos, categorías, mapa de calor por hora, descuentos, comparativas y salud del catálogo
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="font-normal">Top productos</Badge>
                  <Badge variant="outline" className="font-normal">Categorías</Badge>
                  <Badge variant="outline" className="font-normal">Heat map</Badge>
                  <Badge variant="outline" className="font-normal">Tickets</Badge>
                  <Badge variant="outline" className="font-normal">Descuentos</Badge>
                  <Badge variant="outline" className="font-normal">Comparar</Badge>
                  <Badge variant="outline" className="font-normal">Catálogo</Badge>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-600 shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </CardContent>
      </Card>

      <AnalyticsToolbar
        preset={filters.preset}
        customFromIso={filters.customFromIso}
        customToIso={filters.customToIso}
        comparisonMode={filters.comparisonMode}
        range={filters.range}
        comparisonRange={filters.comparisonRange}
        allBusinesses={scope.businesses.map((b) => ({ id: b.id, name: b.name }))}
        selectedBusinessIdsFromUrl={filters.selectedBusinessIdsFromUrl}
        showBusinessSelector={scope.businesses.length > 1}
      >
        <ExportMenu />
      </AnalyticsToolbar>

      {/* KPIs principales */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas totales"
          value={fmt(kpis.salesTotal)}
          delta={kpis.salesDelta}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          color="green"
        />
        <KpiCard
          label="Utilidad neta"
          value={fmt(kpis.netTotal)}
          delta={kpis.netDelta}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          color={kpis.netTotal >= 0 ? "blue" : "red"}
        />
        <KpiCard
          label="Ticket promedio"
          value={fmt(kpis.avgTicket)}
          delta={kpis.avgTicketDelta}
          icon={<DollarSign className="h-4 w-4 text-purple-600" />}
          color="purple"
        />
        <KpiCard
          label="Total tickets"
          value={fmtNum(kpis.salesCount)}
          icon={<FileText className="h-4 w-4 text-orange-600" />}
          color="orange"
        />
      </div>

      {/* Insights destacados */}
      {(bestWeekday || bestHour) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {bestWeekday && bestWeekday.value > 0 && (
            <Card className="bg-gradient-to-br from-emerald-50 to-transparent border-emerald-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Mejor día de la semana</p>
                  <p className="text-lg font-bold">
                    {fullWeekdayName(bestWeekday.weekday)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(bestWeekday.value)} en total · {bestWeekday.count} tickets
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {bestHour && bestHour.value > 0 && hasHourlyData && (
            <Card className="bg-gradient-to-br from-blue-50 to-transparent border-blue-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Hora pico</p>
                  <p className="text-lg font-bold">{bestHour.hour}:00 hrs</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(bestHour.value)} en total · {bestHour.count} tickets
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tendencia general */}
      <TimeSeriesChart
        title={`Tendencia de ventas (${filters.range.label})`}
        data={salesSeries.map((p) => ({ label: p.label, value: p.value, count: p.count }))}
        comparisonData={mergedComp}
        type="area"
        color="#3b82f6"
        height={300}
      />

      {/* Patrones: día de semana + hora del día */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              Ventas por día de la semana
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ComparisonBarChart
              data={byWeekday.map((d) => ({ label: d.label, value: d.value, count: d.count }))}
              color="#10b981"
              highlightMax
              height={220}
            />
          </CardContent>
        </Card>

        {hasHourlyData && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Ventas por hora del día
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <ComparisonBarChart
                data={byHour.map((h) => ({ label: h.label, value: h.value, count: h.count }))}
                color="#3b82f6"
                highlightMax
                height={220}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comparativa de negocios (si hay >1) */}
      {byBusiness.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Comparativa entre negocios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Negocio</th>
                    <th className="text-right px-4 py-2">Ventas</th>
                    <th className="text-right px-4 py-2 hidden md:table-cell">Δ vs comparación</th>
                    <th className="text-right px-4 py-2 hidden lg:table-cell">Ticket prom.</th>
                    <th className="text-right px-4 py-2 hidden md:table-cell">Tickets</th>
                    <th className="text-right px-4 py-2">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byBusiness.map((b) => (
                    <tr key={b.businessId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{b.businessName}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(b.salesTotal)}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {b.salesDelta !== null ? (
                          <span className={b.salesDelta >= 0 ? "text-green-600" : "text-red-600"}>
                            {b.salesDelta >= 0 ? "+" : ""}{b.salesDelta.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                        {fmt(b.avgTicket)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {fmtNum(b.salesCount)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${b.netTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(b.netTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-bold">
                  <tr>
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">{fmt(byBusiness.reduce((s, b) => s + b.salesTotal, 0))}</td>
                    <td className="hidden md:table-cell"></td>
                    <td className="hidden lg:table-cell"></td>
                    <td className="px-4 py-2 text-right hidden md:table-cell">
                      {fmtNum(byBusiness.reduce((s, b) => s + b.salesCount, 0))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {fmt(byBusiness.reduce((s, b) => s + b.netTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribución métodos pago */}
      <DistributionDonut
        title="Distribución por método de pago"
        items={byMethod}
        height={220}
      />
    </div>
  );
}

function fullWeekdayName(dow: number): string {
  return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dow];
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  DollarSign, TrendingDown, TrendingUp, Receipt, Wallet, ArrowLeft,
  Building2, LayoutDashboard, FileText,
} from "lucide-react";

import { resolveManagerScope } from "@/lib/manager-scope";
import { resolveAnalyticsFilters } from "@/lib/analytics-filters";
import {
  getKpisWithDelta, getSalesTimeSeries, getExpensesTimeSeries,
  getSalesByMethod, getExpensesByCategory, getAnalyticsByBusiness,
} from "@/lib/analytics";
import { suggestGranularity } from "@/lib/date-presets";
import { prisma } from "@/lib/prisma";

import { AnalyticsToolbar } from "@/components/analytics/AnalyticsToolbar";
import { KpiCard } from "@/components/analytics/KpiCard";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { DistributionDonut } from "@/components/analytics/DistributionDonut";
import { RecentTransactions } from "@/components/analytics/RecentTransactions";
import { ExportMenu } from "@/components/analytics/ExportMenu";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtNum = (n: number) => new Intl.NumberFormat("es-MX").format(n);

export default async function ManagerFinancesPage({
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

  // ───────────────────────────────────────────────────────────
  // QUERIES
  // ───────────────────────────────────────────────────────────
  const [
    kpis, salesSeries, expensesSeries, salesSeriesComp, expensesSeriesComp,
    salesByMethod, expensesByCategory, byBusiness,
    recentSales, recentExpenses, recentWithdrawals,
    largePendingCount,
  ] = await Promise.all([
    getKpisWithDelta(filters.selectedBusinessIds, filters.range, filters.comparisonRange),
    getSalesTimeSeries(filters.selectedBusinessIds, filters.range, granularity),
    getExpensesTimeSeries(filters.selectedBusinessIds, filters.range, granularity),
    filters.comparisonRange
      ? getSalesTimeSeries(filters.selectedBusinessIds, filters.comparisonRange, granularity)
      : Promise.resolve([]),
    filters.comparisonRange
      ? getExpensesTimeSeries(filters.selectedBusinessIds, filters.comparisonRange, granularity)
      : Promise.resolve([]),
    getSalesByMethod(filters.selectedBusinessIds, filters.range),
    getExpensesByCategory(filters.selectedBusinessIds, filters.range),
    scope.businesses.length > 1
      ? getAnalyticsByBusiness(filters.selectedBusinessIds, businessesMap, filters.range)
      : Promise.resolve([]),

    // Recientes del período
    prisma.sale.findMany({
      where: {
        businessId: { in: filters.selectedBusinessIds },
        createdAt: { gte: filters.range.from, lt: filters.range.to },
      },
      include: {
        business: { select: { name: true } },
        user: { select: { fullName: true } },
        cashpoint: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.expense.findMany({
      where: {
        businessId: { in: filters.selectedBusinessIds },
        createdAt: { gte: filters.range.from, lt: filters.range.to },
      },
      include: {
        business: { select: { name: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.withdrawal.findMany({
      where: {
        businessId: { in: filters.selectedBusinessIds },
        createdAt: { gte: filters.range.from, lt: filters.range.to },
      },
      include: {
        cashpoint: { select: { name: true } },
        business: { select: { name: true } },
        requestedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.withdrawal.count({
      where: { businessId: { in: filters.selectedBusinessIds }, status: "REQUESTED" },
    }),
  ]);

  const mergedSalesComp = filters.comparisonRange
    ? salesSeries.map((_, i) => ({
        label: salesSeriesComp[i]?.label ?? "", value: salesSeriesComp[i]?.value ?? 0,
      }))
    : undefined;
  const mergedExpensesComp = filters.comparisonRange
    ? expensesSeries.map((_, i) => ({
        label: expensesSeriesComp[i]?.label ?? "", value: expensesSeriesComp[i]?.value ?? 0,
      }))
    : undefined;

  // Datos serializados para RecentTransactions (que es client component)
  const recentSalesSerialized = recentSales.map((s) => ({
    id: s.id,
    amountCents: s.amountCents,
    method: s.method as "CASH" | "CARD" | "TRANSFER",
    concept: s.concept,
    createdAt: s.createdAt.toISOString(),
    businessName: s.business.name,
    userName: s.user.fullName,
    cashpointName: s.cashpoint.name,
  }));

  const recentExpensesSerialized = recentExpenses.map((e) => ({
    id: e.id,
    amountCents: e.amountCents,
    category: e.category,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    businessName: e.business.name,
    userName: e.user.fullName,
  }));

  const drillDownFilters = {
    fromIso: filters.range.from.toISOString(),
    toIso: filters.range.to.toISOString(),
    businessIds: filters.selectedBusinessIds,
  };

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
            <DollarSign className="w-7 h-7 text-green-500" />
            Finanzas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análisis financiero con ventas, gastos, retiros y comparativos
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ops">
              <LayoutDashboard className="w-4 h-4 mr-1.5" /> Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/manager/ops/reports">
              <FileText className="w-4 h-4 mr-1.5" /> Reportes
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
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

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas totales"
          value={fmt(kpis.salesTotal)}
          delta={kpis.salesDelta}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          color="green"
          subtitle={`${fmtNum(kpis.salesCount)} tickets`}
        />
        <KpiCard
          label="Gastos totales"
          value={fmt(kpis.expensesTotal)}
          delta={kpis.expensesDelta}
          invertDelta={true}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          color="red"
        />
        <KpiCard
          label="Utilidad neta"
          value={fmt(kpis.netTotal)}
          delta={kpis.netDelta}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          color={kpis.netTotal >= 0 ? "blue" : "red"}
          subtitle="Ventas − Gastos"
        />
        <KpiCard
          label="Ticket promedio"
          value={fmt(kpis.avgTicket)}
          delta={kpis.avgTicketDelta}
          icon={<Receipt className="h-4 w-4 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Gráficas principales: ventas + gastos en stack */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Ventas en el tiempo"
          data={salesSeries.map((p) => ({ label: p.label, value: p.value, count: p.count }))}
          comparisonData={mergedSalesComp}
          type="area"
          color="#10b981"
        />
        <TimeSeriesChart
          title="Gastos en el tiempo"
          data={expensesSeries.map((p) => ({ label: p.label, value: p.value, count: p.count }))}
          comparisonData={mergedExpensesComp}
          type="area"
          color="#ef4444"
        />
      </div>

      {/* Distribuciones */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionDonut
          title="Ventas por método de pago"
          items={salesByMethod}
        />
        <DistributionDonut
          title="Gastos por categoría"
          items={expensesByCategory}
        />
      </div>

      {/* Por negocio */}
      {byBusiness.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Comparativa por negocio
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {filters.range.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2">Negocio</th>
                    <th className="text-right px-4 py-2">Ventas</th>
                    <th className="text-right px-4 py-2 hidden md:table-cell">Tickets</th>
                    <th className="text-right px-4 py-2">Gastos</th>
                    <th className="text-right px-4 py-2">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byBusiness.map((b) => (
                    <tr key={b.businessId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{b.businessName}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmt(b.salesTotal)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {fmtNum(b.salesCount)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt(b.expensesTotal)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${b.netTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(b.netTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-bold">
                  <tr>
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">
                      {fmt(byBusiness.reduce((s, b) => s + b.salesTotal, 0))}
                    </td>
                    <td className="px-4 py-2 text-right hidden md:table-cell">
                      {fmtNum(byBusiness.reduce((s, b) => s + b.salesCount, 0))}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {fmt(byBusiness.reduce((s, b) => s + b.expensesTotal, 0))}
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

      {/* Transacciones recientes con drill-down */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentTransactions
          type="sales"
          title="Ventas recientes"
          rows={recentSalesSerialized}
          showBusinessName={scope.businesses.length > 1}
          drillDownFilters={drillDownFilters}
          rangeLabel={filters.range.label}
        />
        <RecentTransactions
          type="expenses"
          title="Gastos recientes"
          rows={recentExpensesSerialized}
          showBusinessName={scope.businesses.length > 1}
          drillDownFilters={drillDownFilters}
          rangeLabel={filters.range.label}
        />
      </div>

      {/* Retiros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Retiros de caja
            {largePendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {largePendingCount} pendientes
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentWithdrawals.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sin retiros en este período.
            </div>
          ) : (
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {recentWithdrawals.map((w) => {
                const statusBadge = (
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      w.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" :
                      w.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {w.status === "APPROVED" ? "Aprobado" :
                     w.status === "REJECTED" ? "Rechazado" : "Pendiente"}
                  </Badge>
                );
                return (
                  <div key={w.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {w.reason ?? "Sin concepto"}
                        </p>
                        <Badge variant="secondary" className="text-[9px]">
                          {w.kind === "PETTY_CASH" ? "Caja chica" : "Retiro grande"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {w.requestedBy.fullName}
                        {w.cashpoint?.name && ` · Caja: ${w.cashpoint.name}`}
                        {scope.businesses.length > 1 && ` · ${w.business.name}`}
                        {" · "}
                        {new Date(w.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric", month: "short", timeZone: "America/Mexico_City",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge}
                      <span className="text-sm font-bold">{fmt(w.amountCents)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

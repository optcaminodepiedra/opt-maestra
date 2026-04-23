"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet, Building2, Download, FileText,
  CreditCard, Banknote, ArrowLeftRight,
} from "lucide-react";
import type { GlobalReportData } from "@/lib/global-reports";

type Props = {
  data: GlobalReportData;
  year: number;
  month: number;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const METHOD_CONFIG = {
  CASH:     { label: "Efectivo",     icon: Banknote,       color: "text-green-600",  bg: "bg-green-50" },
  CARD:     { label: "Tarjeta",      icon: CreditCard,     color: "text-blue-600",   bg: "bg-blue-50" },
  TRANSFER: { label: "Transferencia",icon: ArrowLeftRight, color: "text-purple-600", bg: "bg-purple-50" },
};

export function GlobalReportClient({ data, year, month }: Props) {
  function exportCSV() {
    const headers = "Negocio,Ventas,Transacciones,Gastos,Retiros,Neto,% Ventas\n";
    const rows = data.byBusiness
      .map((b) =>
        [
          b.businessName,
          (b.salesCents / 100).toFixed(2),
          b.salesCount,
          (b.expensesCents / 100).toFixed(2),
          (b.withdrawalsCents / 100).toFixed(2),
          (b.netCents / 100).toFixed(2),
          b.pctOfTotal.toFixed(1) + "%",
        ].join(",")
      )
      .join("\n");

    const csv = headers + rows +
      `\n\nTotales,${(data.totalSalesCents / 100).toFixed(2)},${data.totalSalesCount},${(data.totalExpensesCents / 100).toFixed(2)},${(data.totalWithdrawalsCents / 100).toFixed(2)},${(data.netCents / 100).toFixed(2)}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-global-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard color="green" label="Ventas" value={fmt(data.totalSalesCents)} subtitle={`${data.totalSalesCount} transacciones`} icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />} />
        <KpiCard color="red"   label="Gastos" value={fmt(data.totalExpensesCents)} subtitle="Mes actual" icon={<TrendingDown className="h-3.5 w-3.5 text-red-400" />} />
        <KpiCard color="amber" label="Retiros" value={fmt(data.totalWithdrawalsCents)} subtitle="Aprobados" icon={<Wallet className="h-3.5 w-3.5 text-amber-500" />} />
        <KpiCard color={data.netCents >= 0 ? "purple" : "red"} label="Neto" value={fmt(data.netCents)} subtitle="Ventas − gastos − retiros" icon={<FileText className="h-3.5 w-3.5 text-purple-500" />} valueColor={data.netCents >= 0 ? "" : "text-red-600"} />
      </div>

      {/* Por método de pago */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ventas por método de pago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(["CASH", "CARD", "TRANSFER"] as const).map((method) => {
              const cfg = METHOD_CONFIG[method];
              const Icon = cfg.icon;
              const amount = data.byMethod[method];
              const pct = data.totalSalesCents > 0 ? (amount / data.totalSalesCents) * 100 : 0;
              return (
                <div key={method} className={`border rounded-lg p-3 ${cfg.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <p className="text-xs font-medium">{cfg.label}</p>
                  </div>
                  <p className="text-lg font-bold">{fmt(amount)}</p>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Por negocio */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Por negocio
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data.byBusiness.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay movimientos para {MONTHS[month - 1]} {year}
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-6 gap-2 px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">
                <div className="col-span-2">Negocio</div>
                <div className="text-right">Ventas</div>
                <div className="text-right">Gastos</div>
                <div className="text-right">Retiros</div>
                <div className="text-right">Neto</div>
              </div>
              {data.byBusiness.map((b) => (
                <div key={b.businessId} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm hover:bg-muted/30">
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium truncate">{b.businessName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.salesCount} tx · {b.pctOfTotal.toFixed(1)}% del total
                    </p>
                  </div>
                  <div className="text-right font-medium text-green-700">{fmt(b.salesCents)}</div>
                  <div className="text-right text-red-600">−{fmt(b.expensesCents)}</div>
                  <div className="text-right text-amber-600">−{fmt(b.withdrawalsCents)}</div>
                  <div className={`text-right font-bold ${b.netCents >= 0 ? "" : "text-red-600"}`}>
                    {fmt(b.netCents)}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-6 gap-2 px-4 py-3 text-sm bg-muted/40 font-bold">
                <div className="col-span-2">TOTAL</div>
                <div className="text-right text-green-700">{fmt(data.totalSalesCents)}</div>
                <div className="text-right text-red-600">−{fmt(data.totalExpensesCents)}</div>
                <div className="text-right text-amber-600">−{fmt(data.totalWithdrawalsCents)}</div>
                <div className={`text-right ${data.netCents >= 0 ? "" : "text-red-600"}`}>{fmt(data.netCents)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top categorías de gasto */}
      {data.topExpenseCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top categorías de gasto</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.topExpenseCategories.map((c) => {
                const pct = data.totalExpensesCents > 0 ? (c.cents / data.totalExpensesCents) * 100 : 0;
                return (
                  <div key={c.category} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{c.category}</p>
                        <span className="text-sm font-bold ml-2 shrink-0">{fmt(c.cents)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.count} gastos · {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desglose diario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Desglose diario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.byDay.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos en este periodo.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Día</th>
                    <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Ventas</th>
                    <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Tx</th>
                    <th className="text-right px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Gastos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.byDay.map((d) => (
                    <tr key={d.dateIso} className="hover:bg-muted/20">
                      <td className="px-4 py-2">
                        {new Date(d.dateIso + "T00:00:00").toLocaleDateString("es-MX", {
                          weekday: "short", day: "numeric", month: "short",
                        })}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-green-700">
                        {d.salesCents > 0 ? fmt(d.salesCents) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {d.salesCount > 0 ? d.salesCount : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {d.expensesCents > 0 ? `−${fmt(d.expensesCents)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ color, label, value, subtitle, icon, valueColor }: {
  color: string; label: string; value: string; subtitle: string;
  icon: React.ReactNode; valueColor?: string;
}) {
  return (
    <Card className={`border-l-4 border-l-${color}-500 py-0`}>
      <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-xl font-bold ${valueColor ?? ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

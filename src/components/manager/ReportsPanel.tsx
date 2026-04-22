"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, TrendingDown, Wallet } from "lucide-react";

type MonthlyRow = {
  businessId: string;
  businessName: string;
  salesCents: number;
  salesCount: number;
  expensesCents: number;
  withdrawalsCents: number;
  netCents: number;
};

type DailyRow = {
  dateIso: string;
  salesCents: number;
  salesCount: number;
  expensesCents: number;
};

type Props = {
  year: number;
  month: number; // 1-12
  monthly: MonthlyRow[];
  daily: DailyRow[];
  showBusinessColumn: boolean;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function ReportsPanel({ year, month, monthly, daily, showBusinessColumn }: Props) {
  const totals = useMemo(() => {
    return monthly.reduce(
      (acc, r) => ({
        sales: acc.sales + r.salesCents,
        salesCount: acc.salesCount + r.salesCount,
        expenses: acc.expenses + r.expensesCents,
        withdrawals: acc.withdrawals + r.withdrawalsCents,
        net: acc.net + r.netCents,
      }),
      { sales: 0, salesCount: 0, expenses: 0, withdrawals: 0, net: 0 }
    );
  }, [monthly]);

  function downloadCSV() {
    const header = "Fecha,Ventas,# Transacciones,Gastos\n";
    const rows = daily
      .map((d) => `${d.dateIso},${(d.salesCents / 100).toFixed(2)},${d.salesCount},${(d.expensesCents / 100).toFixed(2)}`)
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Totales del mes */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="py-0 border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ventas mes</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(totals.sales)}</div>
            <p className="text-xs text-muted-foreground">{totals.salesCount} tx</p>
          </CardContent>
        </Card>

        <Card className="py-0 border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gastos mes</CardTitle>
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(totals.expenses)}</div>
          </CardContent>
        </Card>

        <Card className="py-0 border-l-4 border-l-amber-500">
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Retiros mes</CardTitle>
            <Wallet className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold">{fmt(totals.withdrawals)}</div>
          </CardContent>
        </Card>

        <Card className={`py-0 border-l-4 ${totals.net >= 0 ? "border-l-purple-500" : "border-l-red-600"}`}>
          <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Neto</CardTitle>
            <FileText className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-xl font-bold ${totals.net >= 0 ? "" : "text-red-600"}`}>
              {fmt(totals.net)}
            </div>
            <p className="text-xs text-muted-foreground">Ventas − gastos − retiros</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por negocio */}
      {showBusinessColumn && monthly.length > 1 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Por negocio</CardTitle>
            <span className="text-xs text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[10px] font-semibold uppercase text-muted-foreground">
                <div className="col-span-2">Negocio</div>
                <div className="text-right">Ventas</div>
                <div className="text-right">Gastos</div>
                <div className="text-right">Neto</div>
              </div>
              {monthly.map((r) => (
                <div key={r.businessId} className="grid grid-cols-5 gap-2 px-4 py-3 text-sm hover:bg-muted/30">
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium truncate">{r.businessName}</p>
                    <p className="text-[10px] text-muted-foreground">{r.salesCount} tx</p>
                  </div>
                  <div className="text-right font-medium text-green-700">{fmt(r.salesCents)}</div>
                  <div className="text-right text-red-600">−{fmt(r.expensesCents)}</div>
                  <div className={`text-right font-bold ${r.netCents >= 0 ? "" : "text-red-600"}`}>
                    {fmt(r.netCents)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla diaria + export */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Desglose diario</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {daily.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos en este periodo.
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
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
                  {daily.map((d) => (
                    <tr key={d.dateIso} className="hover:bg-muted/20">
                      <td className="px-4 py-2">
                        {new Date(d.dateIso + "T00:00:00").toLocaleDateString("es-MX", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
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

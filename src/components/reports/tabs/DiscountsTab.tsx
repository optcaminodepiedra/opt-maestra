"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Percent, AlertCircle } from "lucide-react";
import { getDiscountAnalysis } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type Data = {
  totalSales: number;
  salesWithDiscount: number;
  pctSalesWithDiscount: number;
  totalDiscountAmount: number;
  avgDiscountPerTicket: number;
  lineDiscountCount: number;
  lineDiscountAmount: number;
  topDiscountedProducts: {
    productCode: string; productName: string;
    timesDiscounted: number; qtyDiscounted: number; totalDiscount: number;
  }[];
};

export default function DiscountsTab(props: { filters: ReportFilters }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    getDiscountAnalysis(props.filters)
      .then(d => setData(d as Data))
      .finally(() => setLoading(false));
  }, [props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.includeCanceled]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  if (!data || data.totalSales === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">Sin datos en el rango.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs descuentos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Tickets con descuento</div>
          <div className="text-2xl font-semibold">{data.salesWithDiscount.toLocaleString()}</div>
          <div className="text-xs text-slate-500">de {data.totalSales.toLocaleString()} ({data.pctSalesWithDiscount.toFixed(1)}%)</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Descuento total (cheque)</div>
          <div className="text-2xl font-semibold text-amber-700">-${data.totalDiscountAmount.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Promedio por ticket</div>
          <div className="text-2xl font-semibold">${data.avgDiscountPerTicket.toFixed(2)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Descuento por línea</div>
          <div className="text-2xl font-semibold text-amber-700">-${data.lineDiscountAmount.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
          <div className="text-xs text-slate-500">{data.lineDiscountCount} líneas</div>
        </Card>
      </div>

      {/* Top productos descontados */}
      <Card className="p-4">
        <h3 className="font-semibold flex items-center mb-3">
          <Percent className="h-5 w-5 mr-2 text-amber-600" /> Top productos descontados
        </h3>
        {data.topDiscountedProducts.length === 0 ? (
          <p className="text-sm text-slate-500">No hay descuentos por línea de producto en el rango.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Producto</th>
                  <th className="text-right">Veces descontado</th>
                  <th className="text-right">Unidades</th>
                  <th className="text-right">$ Descuento total</th>
                </tr>
              </thead>
              <tbody>
                {data.topDiscountedProducts.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 font-medium">{p.productName}</td>
                    <td className="text-right">{p.timesDiscounted}</td>
                    <td className="text-right">{p.qtyDiscounted.toLocaleString()}</td>
                    <td className="text-right text-amber-700 font-medium">-${p.totalDiscount.toLocaleString("es-MX", {minimumFractionDigits:2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

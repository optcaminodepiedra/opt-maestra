"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getTopProducts, getSlowProducts, getNoMovementProducts } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type TopRow = { productCode: string; productName: string; groupCode: string | null; groupName: string | null; revenue: number; qty: number; discount: number; timesSold: number; };
type SlowRow = { productCode: string; productName: string; groupName: string | null; revenue: number; qty: number; timesSold: number; };
type NoMovementRow = { productCode: string; productName: string; groupName: string | null; priceCents: number; };

export default function TopProductsTab(props: { filters: ReportFilters }) {
  const [sortBy, setSortBy] = useState<"revenue" | "qty">("revenue");
  const [top, setTop] = useState<TopRow[]>([]);
  const [slow, setSlow] = useState<SlowRow[]>([]);
  const [noMovement, setNoMovement] = useState<NoMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoMovement, setShowNoMovement] = useState(false);

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    Promise.all([
      getTopProducts(props.filters, { limit: 20, sortBy }),
      getSlowProducts(props.filters, { limit: 20 }),
      getNoMovementProducts(props.filters),
    ]).then(([t, s, nm]) => {
      setTop(t as TopRow[]);
      setSlow(s as SlowRow[]);
      setNoMovement(nm as NoMovementRow[]);
    }).finally(() => setLoading(false));
  }, [props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.groupCode, props.filters.includeCanceled, sortBy]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="text-sm text-slate-500 mt-2">Cargando...</p>
      </div>
    );
  }

  if (top.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">No hay ventas con detalle en este rango.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" /> Top 20 productos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ordenados por {sortBy === "revenue" ? "ingreso" : "cantidad vendida"}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={sortBy === "revenue" ? "default" : "outline"} onClick={() => setSortBy("revenue")}>$ Ingreso</Button>
            <Button size="sm" variant={sortBy === "qty" ? "default" : "outline"} onClick={() => setSortBy("qty")}># Cantidad</Button>
          </div>
        </div>

        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
              <XAxis type="number" tick={{ fontSize: 12 }}
                tickFormatter={(v) => sortBy === "revenue" ? `$${v.toLocaleString()}` : `${v}`} />
              <YAxis type="category" dataKey="productName" tick={{ fontSize: 11 }} width={120}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "…" : v} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const r: any = payload[0].payload;
                  return (
                    <div className="bg-white border rounded shadow-lg p-2 text-xs">
                      <p className="font-semibold">{r.productName}</p>
                      <p className="text-slate-500">{r.groupName || "Sin grupo"} · cod {r.productCode}</p>
                      <p className="mt-1">Ingreso: <strong>${r.revenue.toLocaleString("es-MX", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></p>
                      <p>Cantidad: <strong>{r.qty}</strong></p>
                      <p>Veces vendido: <strong>{r.timesSold}</strong></p>
                      {r.discount > 0 && <p className="text-amber-600">Descuentos: ${r.discount.toFixed(2)}</p>}
                    </div>
                  );
                }} />
              <Bar dataKey={sortBy === "revenue" ? "revenue" : "qty"} radius={[0, 4, 4, 0]}>
                {top.slice(0, 15).map((_, i) => (
                  <Cell key={i} fill={i < 3 ? "#2563eb" : "#60a5fa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600 hover:underline">Ver tabla completa</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">#</th>
                  <th>Producto</th>
                  <th>Grupo</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Ingreso</th>
                  <th className="text-right">Tickets</th>
                </tr>
              </thead>
              <tbody>
                {top.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 text-slate-500">{i+1}</td>
                    <td className="font-medium">{row.productName}</td>
                    <td className="text-xs text-slate-500">{row.groupName || "—"}</td>
                    <td className="text-right">{row.qty.toLocaleString()}</td>
                    <td className="text-right font-medium">${row.revenue.toLocaleString("es-MX", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    <td className="text-right text-slate-500">{row.timesSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold flex items-center mb-2">
          <TrendingDown className="h-5 w-5 mr-2 text-amber-600" /> Productos lentos
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Productos vendidos pero con baja rotación. Candidatos a revisar precio/visibilidad.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1">Producto</th>
                <th>Grupo</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">Ingreso</th>
                <th className="text-right">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {slow.slice(0, 15).map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1 font-medium">{row.productName}</td>
                  <td className="text-xs text-slate-500">{row.groupName || "—"}</td>
                  <td className="text-right">{row.qty.toLocaleString()}</td>
                  <td className="text-right">${row.revenue.toLocaleString("es-MX", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td className="text-right text-slate-500">{row.timesSold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
              Productos sin movimiento ({noMovement.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              En catálogo pero NO se vendieron en este periodo.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowNoMovement(!showNoMovement)}>
            {showNoMovement ? "Ocultar" : "Ver todos"}
          </Button>
        </div>
        {showNoMovement && (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Código</th>
                  <th>Producto</th>
                  <th>Grupo</th>
                  <th className="text-right">Precio cat.</th>
                </tr>
              </thead>
              <tbody>
                {noMovement.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 text-xs text-slate-500">{row.productCode}</td>
                    <td>{row.productName}</td>
                    <td className="text-xs text-slate-500">{row.groupName || "—"}</td>
                    <td className="text-right">${(row.priceCents/100).toFixed(2)}</td>
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

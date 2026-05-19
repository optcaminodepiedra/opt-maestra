"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare, AlertCircle, X, Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { compareProducts, getProductsList } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type ProductOption = { code: string; name: string; groupName: string | null };
type CompareRow = {
  productCode: string; productName: string; groupName: string | null;
  revenue: number; qty: number; discount: number; timesSold: number;
  trend: { week: string; revenue: number; qty: number }[];
};

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#9333ea"];

export default function CompareTab(props: { filters: ReportFilters }) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<ProductOption[]>([]);
  const [results, setResults] = useState<CompareRow[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (!props.filters.businessId) return;
    const t = setTimeout(() => {
      setLoadingSearch(true);
      getProductsList(props.filters.businessId, search)
        .then(p => setProducts(p as ProductOption[]))
        .finally(() => setLoadingSearch(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, props.filters.businessId]);

  useEffect(() => {
    if (selected.length === 0) {
      setResults([]);
      return;
    }
    setLoadingResults(true);
    compareProducts(props.filters, selected.map(s => s.code))
      .then(r => setResults(r as CompareRow[]))
      .finally(() => setLoadingResults(false));
  }, [selected, props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.includeCanceled]);

  const addProduct = (p: ProductOption) => {
    if (selected.find(s => s.code === p.code)) return;
    if (selected.length >= 5) return; // máx 5
    setSelected([...selected, p]);
  };

  const removeProduct = (code: string) => {
    setSelected(selected.filter(s => s.code !== code));
  };

  // Mezclar trend data para line chart (week → { revenue_code1, revenue_code2, ... })
  const allWeeks = new Set<string>();
  for (const r of results) {
    for (const t of r.trend) allWeeks.add(t.week);
  }
  const weeksSorted = Array.from(allWeeks).sort();
  const chartData = weeksSorted.map(week => {
    const row: any = { week };
    for (const r of results) {
      const t = r.trend.find(x => x.week === week);
      row[`rev_${r.productCode}`] = t ? t.revenue : 0;
      row[`qty_${r.productCode}`] = t ? t.qty : 0;
    }
    return row;
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold flex items-center mb-3">
          <GitCompare className="h-5 w-5 mr-2 text-blue-600" /> Comparar productos
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Busca y selecciona hasta 5 productos para comparar ventas y tendencias semanales.
        </p>

        {/* Selected products */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map((p, i) => (
              <Badge key={p.code} variant="outline" className="pl-2 pr-1 py-1 gap-1"
                style={{ borderColor: COLORS[i], color: COLORS[i] }}>
                {p.name}
                <button onClick={() => removeProduct(p.code)} className="ml-1 hover:bg-slate-100 rounded p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca producto por nombre o código..." className="pl-8" />
        </div>

        {loadingSearch && <p className="text-xs text-slate-500 mt-2">Buscando...</p>}

        {!loadingSearch && products.length > 0 && (
          <div className="mt-2 max-h-60 overflow-y-auto border rounded">
            {products.map(p => {
              const isSelected = !!selected.find(s => s.code === p.code);
              return (
                <button key={p.code} onClick={() => addProduct(p)}
                  disabled={isSelected || selected.length >= 5}
                  className={`w-full text-left p-2 text-sm hover:bg-slate-50 border-b last:border-b-0 ${
                    isSelected ? "opacity-50 cursor-not-allowed" : ""
                  }`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">cod {p.code} · {p.groupName || "Sin grupo"}</div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Resultados */}
      {loadingResults && (
        <div className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        </div>
      )}

      {!loadingResults && selected.length > 0 && results.length > 0 && (
        <>
          {/* Tabla comparativa */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Resumen comparativo</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Producto</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Ingreso</th>
                    <th className="text-right">Tickets</th>
                    <th className="text-right">$/Unidad</th>
                    <th className="text-right">Descuentos</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.productCode} className="border-b">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{background: COLORS[i % COLORS.length]}} />
                          <span className="font-medium">{r.productName}</span>
                        </div>
                      </td>
                      <td className="text-right">{r.qty.toLocaleString()}</td>
                      <td className="text-right font-medium">${r.revenue.toLocaleString("es-MX", {minimumFractionDigits:2})}</td>
                      <td className="text-right text-slate-500">{r.timesSold}</td>
                      <td className="text-right">${r.qty ? (r.revenue/r.qty).toFixed(2) : "—"}</td>
                      <td className="text-right text-amber-700">-${r.discount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Trend semanal */}
          {chartData.length > 1 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Tendencia semanal (ingreso)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        return (
                          <div className="bg-white border rounded shadow-lg p-2 text-xs">
                            <p className="font-semibold">Semana: {label}</p>
                            {payload.map((item: any, i: number) => {
                              const code = (item.dataKey as string).replace("rev_", "");
                              const r = results.find(x => x.productCode === code);
                              return (
                                <p key={i} style={{color: item.color}}>
                                  {r?.productName}: ${(item.value as number).toLocaleString("es-MX", {minimumFractionDigits:2})}
                                </p>
                              );
                            })}
                          </div>
                        );
                      }} />
                    <Legend formatter={(value: any) => {
                      const code = value.replace("rev_", "");
                      const r = results.find(x => x.productCode === code);
                      return r?.productName || code;
                    }} />
                    {results.map((r, i) => (
                      <Line key={r.productCode} type="monotone" dataKey={`rev_${r.productCode}`}
                        stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {selected.length === 0 && (
        <Card className="p-8 text-center">
          <GitCompare className="h-10 w-10 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-600">Selecciona al menos un producto para empezar.</p>
        </Card>
      )}
    </div>
  );
}

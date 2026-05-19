"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Package, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { getGroupMix } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type Row = {
  groupCode: string; groupName: string;
  revenue: number; qty: number; times: number; pctOfTotal: number;
};

const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe",
  "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7",
  "#10b981", "#34d399", "#6ee7b7", "#a7f3d0",
  "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#ec4899", "#f472b6", "#f9a8d4"];

export default function CategoriesTab(props: { filters: ReportFilters }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    getGroupMix(props.filters)
      .then(r => setRows(r as Row[]))
      .finally(() => setLoading(false));
  }, [props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.groupCode, props.filters.includeCanceled]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">Sin datos en el rango seleccionado.</p>
      </Card>
    );
  }

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold flex items-center mb-3">
          <Package className="h-5 w-5 mr-2 text-blue-600" /> Mix de venta por categoría
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows.slice(0, 10)} cx="50%" cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.groupName}: ${entry.pctOfTotal.toFixed(1)}%`}
                  outerRadius={100} dataKey="revenue">
                  {rows.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => [
                    `$${(value as number).toLocaleString("es-MX", {minimumFractionDigits:2, maximumFractionDigits:2})}`,
                    props.payload.groupName,
                  ]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="groupName" tick={{ fontSize: 11 }} width={100}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 12) + "…" : v} />
                <Tooltip
                  formatter={(value: any) => `$${(value as number).toLocaleString("es-MX", {minimumFractionDigits:2})}`} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {rows.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Detalle por categoría</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Categoría</th>
                <th className="text-right">Ingreso</th>
                <th className="text-right">% Total</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Líneas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{background: COLORS[i % COLORS.length]}} />
                      <span className="font-medium">{row.groupName}</span>
                    </div>
                  </td>
                  <td className="text-right font-medium">${row.revenue.toLocaleString("es-MX", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td className="text-right">{row.pctOfTotal.toFixed(1)}%</td>
                  <td className="text-right">{row.qty.toLocaleString()}</td>
                  <td className="text-right text-slate-500">{row.times}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t-2">
                <td className="py-2">Total</td>
                <td className="text-right">${totalRevenue.toLocaleString("es-MX", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td className="text-right">100%</td>
                <td className="text-right">{totalQty.toLocaleString()}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

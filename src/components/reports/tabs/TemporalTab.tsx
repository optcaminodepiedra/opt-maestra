"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Clock, AlertCircle } from "lucide-react";
import { getHourlyHeatmap } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type Cell = { dow: number; hour: number; tickets: number; revenue: number; avgTicket: number };

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function TemporalTab(props: { filters: ReportFilters }) {
  const [rows, setRows] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"tickets" | "revenue">("tickets");

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    getHourlyHeatmap(props.filters)
      .then(r => setRows(r as Cell[]))
      .finally(() => setLoading(false));
  }, [props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.includeCanceled]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">Sin datos.</p>
      </Card>
    );
  }

  // Matrix
  const matrix: Record<number, Record<number, Cell>> = {};
  for (let d = 0; d < 7; d++) {
    matrix[d] = {};
    for (let h = 0; h < 24; h++) matrix[d][h] = { dow: d, hour: h, tickets: 0, revenue: 0, avgTicket: 0 };
  }
  for (const r of rows) {
    matrix[r.dow][r.hour] = r;
  }

  const maxValue = Math.max(...rows.map(r => mode === "tickets" ? r.tickets : r.revenue));

  function getColor(val: number) {
    if (val === 0) return "#f8fafc";  // slate-50
    const intensity = val / maxValue;
    // De suave (azul claro) a fuerte (azul oscuro)
    if (intensity < 0.2) return "#dbeafe";  // blue-100
    if (intensity < 0.4) return "#93c5fd";  // blue-300
    if (intensity < 0.6) return "#60a5fa";  // blue-400
    if (intensity < 0.8) return "#3b82f6";  // blue-500
    return "#1d4ed8";  // blue-700
  }

  // KPIs
  const totalTickets = rows.reduce((s, r) => s + r.tickets, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const bestDay = [...Array(7).keys()].map(d => ({
    dow: d,
    tickets: rows.filter(r => r.dow === d).reduce((s, r) => s + r.tickets, 0),
    revenue: rows.filter(r => r.dow === d).reduce((s, r) => s + r.revenue, 0),
  })).sort((a, b) => b.revenue - a.revenue)[0];
  const bestHour = [...Array(24).keys()].map(h => ({
    hour: h,
    tickets: rows.filter(r => r.hour === h).reduce((s, r) => s + r.tickets, 0),
    revenue: rows.filter(r => r.hour === h).reduce((s, r) => s + r.revenue, 0),
  })).sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Total tickets</div>
          <div className="text-2xl font-semibold">{totalTickets.toLocaleString()}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Ingreso total</div>
          <div className="text-2xl font-semibold">${totalRevenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Día pico</div>
          <div className="text-2xl font-semibold">{DAY_NAMES[bestDay.dow]}</div>
          <div className="text-xs text-slate-500">${bestDay.revenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Hora pico</div>
          <div className="text-2xl font-semibold">{bestHour.hour}:00</div>
          <div className="text-xs text-slate-500">${bestHour.revenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" /> Heat map por hora y día
          </h3>
          <div className="flex gap-1">
            <button onClick={() => setMode("tickets")}
              className={`px-2 py-1 text-xs rounded ${mode === "tickets" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
              Tickets
            </button>
            <button onClick={() => setMode("revenue")}
              className={`px-2 py-1 text-xs rounded ${mode === "revenue" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
              Ingreso
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Color más oscuro = más {mode === "tickets" ? "tickets" : "ingreso"}. Pasa el mouse para ver detalles.
        </p>

        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-1 w-8"></th>
                {Array.from({length: 24}, (_, h) => (
                  <th key={h} className="p-1 w-8 text-center font-normal text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 0].map(d => (
                <tr key={d}>
                  <td className="p-1 font-medium text-slate-600 pr-2">{DAY_NAMES[d]}</td>
                  {Array.from({length: 24}, (_, h) => {
                    const cell = matrix[d][h];
                    const value = mode === "tickets" ? cell.tickets : cell.revenue;
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-[10px] cursor-help relative group"
                          style={{ background: getColor(value), color: value / maxValue > 0.5 ? "white" : "#475569" }}
                        >
                          {value > 0 ? (mode === "tickets" ? cell.tickets : `$${(cell.revenue/1000).toFixed(0)}k`) : ""}
                          {value > 0 && (
                            <div className="absolute z-10 invisible group-hover:visible bg-slate-900 text-white text-xs rounded shadow-lg p-2 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap">
                              <div className="font-semibold">{DAY_NAMES[d]} · {h}:00 - {h+1}:00</div>
                              <div>Tickets: {cell.tickets}</div>
                              <div>Ingreso: ${cell.revenue.toLocaleString("es-MX", {maximumFractionDigits:2})}</div>
                              <div>Promedio: ${cell.avgTicket.toFixed(0)}/ticket</div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

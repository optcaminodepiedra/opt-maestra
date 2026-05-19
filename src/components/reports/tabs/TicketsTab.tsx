"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Receipt, AlertCircle, Users, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getTicketStats, getTicketDistribution, getEventsVsRegular } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type Stats = {
  count: number; totalRevenue: number; avgTicket: number;
  medianTicket: number; p25: number; p75: number;
  maxTicket: number; minTicket: number;
  avgItemsPerTicket: number; totalItems: number;
};

type Bucket = { label: string; min: number; max: number; count: number; revenue: number };

type EventsData = {
  regular: { count: number; revenue: number };
  events: { count: number; revenue: number };
  avgEvent: number; avgRegular: number;
};

export default function TicketsTab(props: { filters: ReportFilters }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [distribution, setDistribution] = useState<Bucket[]>([]);
  const [eventsData, setEventsData] = useState<EventsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    Promise.all([
      getTicketStats(props.filters),
      getTicketDistribution(props.filters),
      getEventsVsRegular(props.filters),
    ]).then(([s, d, e]) => {
      setStats(s as Stats);
      setDistribution(d as Bucket[]);
      setEventsData(e as EventsData);
    }).finally(() => setLoading(false));
  }, [props.filters.businessId, props.filters.fromDate, props.filters.toDate, props.filters.includeCanceled]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  if (!stats || stats.count === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">Sin datos en el rango.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-slate-500">Tickets totales</div>
          <div className="text-2xl font-semibold">{stats.count.toLocaleString()}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Ingreso total</div>
          <div className="text-2xl font-semibold">${stats.totalRevenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Ticket promedio</div>
          <div className="text-2xl font-semibold">${stats.avgTicket.toFixed(2)}</div>
          <div className="text-xs text-slate-500">Mediana: ${stats.medianTicket.toFixed(2)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-slate-500">Items por ticket</div>
          <div className="text-2xl font-semibold">{stats.avgItemsPerTicket.toFixed(1)}</div>
          <div className="text-xs text-slate-500">{stats.totalItems.toLocaleString()} items</div>
        </Card>
      </div>

      {/* Percentiles */}
      <Card className="p-4">
        <h3 className="font-semibold flex items-center mb-3">
          <Receipt className="h-5 w-5 mr-2 text-blue-600" /> Estadísticas de ticket
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Mínimo</div>
            <div className="font-semibold">${stats.minTicket.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">P25 (Cuartil bajo)</div>
            <div className="font-semibold">${stats.p25.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Mediana</div>
            <div className="font-semibold text-blue-700">${stats.medianTicket.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">P75 (Cuartil alto)</div>
            <div className="font-semibold">${stats.p75.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Máximo</div>
            <div className="font-semibold">${stats.maxTicket.toFixed(2)}</div>
          </div>
        </div>
      </Card>

      {/* Distribución */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Distribución por rango de monto</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const r: any = payload[0].payload;
                  return (
                    <div className="bg-white border rounded shadow-lg p-2 text-xs">
                      <p className="font-semibold">{r.label}</p>
                      <p>Tickets: <strong>{r.count}</strong></p>
                      <p>Ingreso total: <strong>${r.revenue.toLocaleString("es-MX", {minimumFractionDigits:2})}</strong></p>
                      <p>Promedio: ${r.count ? (r.revenue/r.count).toFixed(2) : 0}</p>
                    </div>
                  );
                }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {distribution.map((_, i) => (
                  <Cell key={i} fill="#3b82f6" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Eventos vs Regular */}
      {eventsData && (
        <Card className="p-4">
          <h3 className="font-semibold flex items-center mb-3">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" /> Eventos vs operación regular
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Eventos: tickets con 8+ items o monto ≥ $2,000. Regular: el resto.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="border-l-4 border-blue-500 pl-3">
              <div className="text-sm font-semibold flex items-center">
                <Users className="h-4 w-4 mr-1" /> Operación regular
              </div>
              <div className="text-2xl font-bold mt-1">{eventsData.regular.count.toLocaleString()} tickets</div>
              <div className="text-sm text-slate-600">${eventsData.regular.revenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
              <div className="text-xs text-slate-500 mt-1">
                Promedio: ${eventsData.avgRegular.toFixed(2)}/ticket
              </div>
            </div>
            <div className="border-l-4 border-purple-500 pl-3">
              <div className="text-sm font-semibold flex items-center">
                <Calendar className="h-4 w-4 mr-1" /> Eventos
              </div>
              <div className="text-2xl font-bold mt-1">{eventsData.events.count.toLocaleString()} tickets</div>
              <div className="text-sm text-slate-600">${eventsData.events.revenue.toLocaleString("es-MX", {maximumFractionDigits:0})}</div>
              <div className="text-xs text-slate-500 mt-1">
                Promedio: ${eventsData.avgEvent.toFixed(2)}/evento
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

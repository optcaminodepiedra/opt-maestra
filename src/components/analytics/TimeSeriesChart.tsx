"use client";

import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Point = {
  label: string;
  value: number;       // cents
  count?: number;
  compareValue?: number;
};

type Props = {
  title?: string;
  data: Point[];
  comparisonData?: Point[];
  type?: "area" | "line";
  height?: number;
  color?: string;
  comparisonColor?: string;
  formatValue?: (v: number) => string;
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

export function TimeSeriesChart({
  title,
  data,
  comparisonData,
  type = "area",
  height = 280,
  color = "#10b981",
  comparisonColor = "#94a3b8",
  formatValue = fmtCurrency,
}: Props) {
  // Mergear data con comparación
  const merged = data.map((p, i) => ({
    ...p,
    compareValue: comparisonData?.[i]?.value,
    compareLabel: comparisonData?.[i]?.label,
  }));

  const content = type === "area" ? (
    <AreaChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
          <stop offset="95%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="colorCompare" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={comparisonColor} stopOpacity={0.25} />
          <stop offset="95%" stopColor={comparisonColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => formatValue(v)}
        width={70}
      />
      <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
      {comparisonData && (
        <Area
          type="monotone"
          dataKey="compareValue"
          stroke={comparisonColor}
          strokeWidth={2}
          strokeDasharray="4 4"
          fill="url(#colorCompare)"
          name="Comparación"
        />
      )}
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2.5}
        fill="url(#colorMain)"
        name="Actual"
      />
      {comparisonData && <Legend iconType="line" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
    </AreaChart>
  ) : (
    <LineChart data={merged} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v) => formatValue(v)}
        width={70}
      />
      <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
      {comparisonData && (
        <Line
          type="monotone"
          dataKey="compareValue"
          stroke={comparisonColor}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          name="Comparación"
        />
      )}
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2.5}
        dot={{ r: 3 }}
        name="Actual"
      />
      {comparisonData && <Legend iconType="line" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
    </LineChart>
  );

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      {content}
    </ResponsiveContainer>
  );

  if (!title) return chart;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">{chart}</CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label, formatValue }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-2.5 text-xs space-y-0.5">
      <p className="font-medium">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

"use client";

import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Point = {
  label: string;
  value: number;
  count?: number;
};

type Props = {
  title?: string;
  data: Point[];
  height?: number;
  color?: string;
  /** Resalta la barra con más valor en otro color */
  highlightMax?: boolean;
  formatValue?: (v: number) => string;
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

export function ComparisonBarChart({
  title, data, height = 220, color = "#3b82f6", highlightMax, formatValue = fmtCurrency,
}: Props) {
  const maxValue = Math.max(...data.map((d) => d.value));

  const content = (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatValue(v)}
          width={70}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as Point;
            return (
              <div className="bg-background border rounded-lg shadow-lg p-2 text-xs space-y-0.5">
                <p className="font-medium">{label}</p>
                <p className="text-muted-foreground">{formatValue(p.value)}</p>
                {p.count !== undefined && <p className="text-muted-foreground">{p.count} tx</p>}
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={highlightMax && d.value === maxValue ? "#10b981" : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  if (!title) return content;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">{content}</CardContent>
    </Card>
  );
}

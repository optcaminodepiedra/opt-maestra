"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DistItem = {
  key: string;
  label: string;
  value: number;
  pct: number;
  count?: number;
};

type Props = {
  title: string;
  items: DistItem[];
  /** Mapa key → color. Si no se da, usa una paleta default. */
  colors?: Record<string, string>;
  formatValue?: (v: number) => string;
  height?: number;
};

const PALETTE = [
  "#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#8b5cf6",
];

const METHOD_COLORS: Record<string, string> = {
  CASH: "#10b981",
  CARD: "#3b82f6",
  TRANSFER: "#a855f7",
};

const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(cents / 100);

export function DistributionDonut({
  title, items, colors, formatValue = fmtCurrency, height = 220,
}: Props) {
  const colorFor = (key: string, idx: number): string => {
    if (colors?.[key]) return colors[key];
    if (METHOD_COLORS[key]) return METHOD_COLORS[key];
    return PALETTE[idx % PALETTE.length];
  };

  const totalValue = items.reduce((s, i) => s + i.value, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Sin datos para este período
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="relative" style={{ height }}>
              <ResponsiveContainer width="100%" height={height}>
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  >
                    {items.map((item, idx) => (
                      <Cell key={item.key} fill={colorFor(item.key, idx)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as DistItem;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                          <p className="font-medium">{item.label}</p>
                          <p>{formatValue(item.value)} ({item.pct.toFixed(1)}%)</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{formatValue(totalValue)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: colorFor(item.key, idx) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.label}</p>
                    <p className="text-muted-foreground">
                      {formatValue(item.value)} · {item.pct.toFixed(1)}%
                      {item.count !== undefined ? ` · ${item.count} tx` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

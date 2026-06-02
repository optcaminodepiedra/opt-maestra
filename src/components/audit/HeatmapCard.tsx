"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { useMemo } from "react";

interface Props {
  heatmap: Array<{ userId: string | null; userName: string; hour: number; count: number }>;
}

export default function HeatmapCard({ heatmap }: Props) {
  // Agrupar por usuario, crear matriz [24 horas]
  const data = useMemo(() => {
    const byUser = new Map<string, { userId: string | null; userName: string; hours: number[] }>();
    for (const row of heatmap) {
      const key = row.userName;
      if (!byUser.has(key)) {
        byUser.set(key, { userId: row.userId, userName: row.userName, hours: Array(24).fill(0) });
      }
      const obj = byUser.get(key)!;
      obj.hours[row.hour] = (obj.hours[row.hour] ?? 0) + row.count;
    }
    // Ordenar por total descendente
    return Array.from(byUser.values())
      .map((u) => ({ ...u, total: u.hours.reduce((s, h) => s + h, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15); // Top 15 usuarios
  }, [heatmap]);

  // Max global para escalar colores
  const maxCount = useMemo(() => {
    let max = 0;
    for (const u of data) {
      for (const h of u.hours) if (h > max) max = h;
    }
    return Math.max(max, 1);
  }, [data]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Mapa de calor por hora del día
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-3">
        <div className="min-w-[600px]">
          {/* Header de horas */}
          <div
            className="grid items-center mb-1"
            style={{ gridTemplateColumns: "100px repeat(24, 1fr) 50px", gap: "2px" }}
          >
            <div></div>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="text-[9px] text-center text-muted-foreground"
                style={{ visibility: h % 3 === 0 ? "visible" : "hidden" }}
              >
                {h}h
              </div>
            ))}
            <div className="text-[9px] text-right text-muted-foreground pr-1">Total</div>
          </div>

          {/* Filas por usuario */}
          {data.map((u) => (
            <div
              key={u.userName}
              className="grid items-center mb-0.5"
              style={{ gridTemplateColumns: "100px repeat(24, 1fr) 50px", gap: "2px" }}
            >
              <div
                className="text-xs text-muted-foreground truncate pr-2"
                title={u.userName}
              >
                {u.userName}
              </div>
              {u.hours.map((count, h) => {
                const intensity = count / maxCount;
                // Verde para baja actividad, azul para media, púrpura para alta
                let bg = "#F3F4F6"; // gris claro
                if (intensity > 0) {
                  if (intensity > 0.66) bg = "#6366F1"; // indigo-500
                  else if (intensity > 0.33) bg = "#A5B4FC"; // indigo-300
                  else bg = "#E0E7FF"; // indigo-100
                }
                return (
                  <div
                    key={h}
                    className="h-[18px] rounded-sm cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: bg }}
                    title={count > 0 ? `${u.userName} · ${h}:00 → ${count} acción${count > 1 ? "es" : ""}` : `${u.userName} · ${h}:00 (sin actividad)`}
                  />
                );
              })}
              <div className="text-[10px] font-medium text-right pr-1">{u.total}</div>
            </div>
          ))}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
          <span>Menos</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "#F3F4F6" }}></div>
            <div className="w-3 h-3 rounded-sm" style={{ background: "#E0E7FF" }}></div>
            <div className="w-3 h-3 rounded-sm" style={{ background: "#A5B4FC" }}></div>
            <div className="w-3 h-3 rounded-sm" style={{ background: "#6366F1" }}></div>
          </div>
          <span>Más actividad</span>
        </div>
      </CardContent>
    </Card>
  );
}

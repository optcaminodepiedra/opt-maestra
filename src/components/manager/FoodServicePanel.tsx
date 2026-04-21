import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Utensils, Users as UsersIcon, Info } from "lucide-react";
import type { FoodServiceDay } from "@/lib/food-service";

type Props = {
  hotelName: string;
  days: FoodServiceDay[];
};

const INTENSITY_CONFIG: Record<
  FoodServiceDay["intensity"],
  { label: string; color: string; bg: string; dots: number }
> = {
  none:      { label: "Sin reservas", color: "text-muted-foreground", bg: "bg-muted/30",   dots: 0 },
  low:       { label: "Bajo",         color: "text-blue-600",         bg: "bg-blue-50",    dots: 1 },
  normal:    { label: "Normal",       color: "text-green-600",        bg: "bg-green-50",   dots: 2 },
  high:      { label: "Alto",         color: "text-amber-600",        bg: "bg-amber-50",   dots: 3 },
  very_high: { label: "Muy alto",     color: "text-red-600",          bg: "bg-red-50",     dots: 4 },
};

export function FoodServicePanel({ hotelName, days }: Props) {
  const totalPax = days.reduce((sum, d) => sum + d.pax, 0);
  const peakDay = days.reduce<FoodServiceDay | null>((peak, d) => {
    if (!peak || d.pax > peak.pax) return d;
    return peak;
  }, null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Utensils className="w-4 h-4 text-amber-600" />
          Servicio de alimentos — próximos 7 días
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Huéspedes del <span className="font-medium">{hotelName}</span> con alimentos incluidos ·
          usa esto para planear personal de cocina y comedor
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Resumen superior */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3 bg-muted/20">
            <p className="text-xs text-muted-foreground">Total comensales (semana)</p>
            <p className="text-lg font-bold flex items-center gap-1">
              <UsersIcon className="w-4 h-4" /> {totalPax}
            </p>
          </div>
          <div className="border rounded-lg p-3 bg-muted/20">
            <p className="text-xs text-muted-foreground">Día pico</p>
            <p className="text-lg font-bold">
              {peakDay && peakDay.pax > 0
                ? `${peakDay.label} · ${peakDay.pax}`
                : "Sin picos"}
            </p>
          </div>
        </div>

        {/* Tabla de días */}
        <div className="border rounded-lg overflow-hidden">
          <div className="divide-y">
            {days.map((d, idx) => {
              const cfg = INTENSITY_CONFIG[d.intensity];
              const isToday = idx === 0;
              return (
                <div
                  key={d.dateIso}
                  className={`flex items-center justify-between px-3 py-2.5 ${
                    isToday ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 shrink-0">
                      <p
                        className={`text-xs font-medium capitalize ${
                          isToday ? "text-primary" : ""
                        }`}
                      >
                        {d.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {d.pax === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          Sin reservas con alimentos
                        </span>
                      ) : (
                        <>
                          <span className="text-sm font-semibold">{d.pax}</span>
                          <span className="text-xs text-muted-foreground">
                            pax · {d.reservationsCount} reserva(s)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {d.pax > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-0.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < cfg.dots ? cfg.color.replace("text-", "bg-") : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {totalPax === 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 bg-muted/20 rounded">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>
              No hay reservas con alimentos incluidos en los próximos 7 días. Cuando Recepción
              registre una reserva y marque "incluye alimentos", aparecerá aquí.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

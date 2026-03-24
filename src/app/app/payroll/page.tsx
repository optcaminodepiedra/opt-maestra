import { getPayrollRecords } from "@/lib/payroll.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock } from "lucide-react";

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control de Asistencias</h1>
          <p className="text-muted-foreground mt-1">
            Revisa las entradas, salidas y evidencias de tu equipo en tiempo real.
          </p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium w-48">Empleado</th>
                  <th className="px-6 py-4 font-medium w-32">Fecha / Estado</th>
                  <th className="px-6 py-4 font-medium">Registros y Evidencias</th>
                  <th className="px-6 py-4 font-medium text-right w-32">Hrs Totales</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((day) => {
                  const entrada = day.punches.find((p) => p.type === "ENTRADA");
                  const salida = day.punches.find((p) => p.type === "SALIDA");
                  
                  let horasTrabajadas = "—";
                  if (entrada && salida) {
                    const diffMs = salida.timestamp.getTime() - entrada.timestamp.getTime();
                    const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
                    horasTrabajadas = `${diffHrs} hrs`;
                  }

                  return (
                    <tr key={day.id} className="hover:bg-muted/10 transition-colors align-top">
                      
                      {/* COLUMNA 1: Empleado */}
                      <td className="px-6 py-6 font-medium">
                        <div className="text-base">{day.user.fullName || "Sin nombre"}</div>
                        <div className="text-xs text-muted-foreground font-normal">{day.user.email}</div>
                      </td>
                      
                      {/* COLUMNA 2: Fecha y Estado */}
                      <td className="px-6 py-6">
                        <div className="font-medium mb-2 whitespace-nowrap">
                          {day.date.toLocaleDateString("es-MX", { weekday: 'short', day: '2-digit', month: 'short' })}
                        </div>
                        {day.status === "OPEN" && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">En Turno</Badge>}
                        {day.status === "NEEDS_REVIEW" && <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Revisar</Badge>}
                        {day.status === "APPROVED" && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Aprobado</Badge>}
                      </td>
                      
                      {/* COLUMNA 3: Las Checadas (Fotos y Mapas) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-4">
                          {day.punches.map((punch) => (
                            <div key={punch.id} className="flex flex-col gap-2 bg-muted/20 p-3 rounded-xl border min-w-[220px]">
                              
                              {/* Encabezado de la checada: Tipo y Hora (Forzada a México) */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                                  {punch.type}
                                </span>
                                <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5" />
                                  {punch.timestamp.toLocaleTimeString("es-MX", { 
                                    timeZone: "America/Mexico_City", // <--- Solución de la hora
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                              </div>

                              {/* Vistas previas de Foto y Mapa */}
                              <div className="flex gap-2 h-24 mt-1">
                                {punch.photoUrl ? (
                                  <img 
                                    src={punch.photoUrl} 
                                    alt="Evidencia" 
                                    className="h-full w-20 object-cover rounded-md border shadow-sm"
                                  />
                                ) : (
                                  <div className="h-full w-20 bg-muted rounded-md flex items-center justify-center text-[10px] text-muted-foreground text-center border">
                                    Sin foto
                                  </div>
                                )}

                                {punch.gpsLat && punch.gpsLng ? (
                                  <iframe 
                                    src={`https://maps.google.com/maps?q=${punch.gpsLat},${punch.gpsLng}&z=15&output=embed`} 
                                    className="h-full flex-1 rounded-md border shadow-sm"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="h-full flex-1 bg-muted rounded-md flex flex-col items-center justify-center text-[10px] text-muted-foreground border">
                                    <MapPin className="w-4 h-4 mb-1" /> Sin GPS
                                  </div>
                                )}
                              </div>

                              {/* Notas */}
                              {punch.note && (
                                <div className="text-xs text-muted-foreground italic mt-1 bg-white p-1.5 rounded border">
                                  "{punch.note}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* COLUMNA 4: Horas */}
                      <td className="px-6 py-6 text-right font-bold text-lg text-primary">
                        {horasTrabajadas}
                      </td>
                    </tr>
                  );
                })}

                {records.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-lg">
                      No hay registros de asistencia todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
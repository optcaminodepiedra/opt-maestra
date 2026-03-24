import { getPayrollRecords } from "@/lib/payroll.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Image as ImageIcon, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control de Asistencias</h1>
          <p className="text-muted-foreground mt-1">
            Revisa las entradas, salidas y evidencias de tu equipo.
          </p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Empleado</th>
                  <th className="px-6 py-4 font-medium">Fecha</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Registros (Evidencia)</th>
                  <th className="px-6 py-4 font-medium text-right">Horas Totales</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((day) => {
                  // Buscamos la primera entrada y la última salida para calcular horas
                  const entrada = day.punches.find((p) => p.type === "ENTRADA");
                  const salida = day.punches.find((p) => p.type === "SALIDA");
                  
                  let horasTrabajadas = "—";
                  if (entrada && salida) {
                    const diffMs = salida.timestamp.getTime() - entrada.timestamp.getTime();
                    const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
                    horasTrabajadas = `${diffHrs} hrs`;
                  }

                  return (
                    <tr key={day.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {day.user.fullName || "Usuario sin nombre"}
                        <div className="text-xs text-muted-foreground font-normal">{day.user.email}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        {day.date.toLocaleDateString("es-MX", { weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      
                      <td className="px-6 py-4">
                        {day.status === "OPEN" && <Badge variant="outline" className="text-blue-600 bg-blue-50">En Turno</Badge>}
                        {day.status === "NEEDS_REVIEW" && <Badge variant="outline" className="text-amber-600 bg-amber-50">Revisar Salida</Badge>}
                        {day.status === "APPROVED" && <Badge variant="outline" className="text-green-600 bg-green-50">Aprobado</Badge>}
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {day.punches.map((punch) => (
                            <div key={punch.id} className="flex items-center gap-3 text-xs bg-muted/30 p-2 rounded-md border">
                              <span className="font-semibold w-16">{punch.type}:</span>
                              <span className="flex items-center gap-1 text-muted-foreground w-12">
                                <Clock className="w-3 h-3" />
                                {punch.timestamp.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              <div className="flex items-center gap-2 ml-auto">
                                {punch.photoUrl && (
                                  <a href={punch.photoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-1" title="Ver foto">
                                    <ImageIcon className="w-4 h-4" />
                                  </a>
                                )}
                                {punch.gpsLat && punch.gpsLng && (
                                  <a href={`https://maps.google.com/?q=${punch.gpsLat},${punch.gpsLng}`} target="_blank" rel="noreferrer" className="text-red-500 hover:text-red-700 flex items-center gap-1" title="Ver en Mapa">
                                    <MapPin className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-lg">
                        {horasTrabajadas}
                      </td>
                    </tr>
                  );
                })}

                {records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
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
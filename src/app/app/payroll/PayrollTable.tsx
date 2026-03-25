"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";
// Importaremos tu acción para aprobar (la crearemos en el siguiente paso)
// import { approveWorkDay } from "@/lib/payroll.actions"; 

export default function PayrollTable({ records }: { records: any[] }) {
  // Estado para saber qué filas están expandidas (guardamos los IDs)
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => 
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const handleApprove = async (id: string) => {
    if (!confirm("¿Aprobar este día de trabajo?")) return;
    // await approveWorkDay(id);
    alert("Acción conectada próximamente");
    // window.location.reload();
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium w-48">Empleado</th>
                <th className="px-6 py-4 font-medium w-32">Fecha / Estado</th>
                <th className="px-6 py-4 font-medium">Resumen</th>
                <th className="px-6 py-4 font-medium text-right w-40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((day) => {
                const isExpanded = expandedRows.includes(day.id);
                const entrada = day.punches.find((p: any) => p.type === "ENTRADA");
                const salida = day.punches.find((p: any) => p.type === "SALIDA");
                const numPunches = day.punches.length;
                
                let horasTrabajadas = "—";
                if (entrada && salida) {
                  const diffMs = salida.timestamp.getTime() - entrada.timestamp.getTime();
                  const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
                  horasTrabajadas = `${diffHrs} hrs`;
                }

                return (
                  <React.Fragment key={day.id}>
                    {/* FILA PRINCIPAL (Siempre visible) */}
                    <tr className={`hover:bg-muted/10 transition-colors ${isExpanded ? 'bg-muted/5' : ''}`}>
                      <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => toggleRow(day.id)}>
                        <div className="text-base">{day.user.fullName || "Sin nombre"}</div>
                        <div className="text-xs text-muted-foreground font-normal">{day.user.email}</div>
                      </td>
                      
                      <td className="px-6 py-4 cursor-pointer" onClick={() => toggleRow(day.id)}>
                        <div className="font-medium mb-1 whitespace-nowrap">
                          {day.date.toLocaleDateString("es-MX", { weekday: 'short', day: '2-digit', month: 'short' })}
                        </div>
                        {day.status === "OPEN" && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">En Turno</Badge>}
                        {day.status === "NEEDS_REVIEW" && <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Revisar</Badge>}
                        {day.status === "APPROVED" && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Aprobado</Badge>}
                      </td>
                      
                      <td className="px-6 py-4 cursor-pointer" onClick={() => toggleRow(day.id)}>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg text-primary">{horasTrabajadas}</span>
                          <Badge variant="secondary" className="font-normal text-xs">
                            {numPunches} registros
                          </Badge>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {day.status === "NEEDS_REVIEW" && (
                            <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(day.id)}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toggleRow(day.id)}>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* FILA COLAPSABLE (Fotos y Mapas) */}
                    {isExpanded && (
                      <tr className="bg-muted/5">
                        <td colSpan={4} className="px-6 py-4 pb-6 border-b-2 border-primary/10">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                            Detalle de Movimientos
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {day.punches.map((punch: any) => (
                              <div key={punch.id} className="flex flex-col gap-2 bg-white p-3 rounded-xl border shadow-sm min-w-[220px]">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${punch.type === 'ENTRADA' ? 'text-green-700 bg-green-100' : 'text-orange-700 bg-orange-100'}`}>
                                    {punch.type}
                                  </span>
                                  <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {punch.timestamp.toLocaleTimeString("es-MX", { 
                                      timeZone: "America/Mexico_City",
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                </div>

                                <div className="flex gap-2 h-24 mt-1">
                                  {punch.photoUrl ? (
                                    <img src={punch.photoUrl} alt="Evidencia" className="h-full w-20 object-cover rounded-md border" />
                                  ) : (
                                    <div className="h-full w-20 bg-muted rounded-md flex items-center justify-center text-[10px] text-muted-foreground text-center border">Sin foto</div>
                                  )}

                                  {punch.gpsLat && punch.gpsLng ? (
                                    <iframe 
                                      src={`https://maps.google.com/maps?q=${punch.gpsLat},${punch.gpsLng}&z=15&output=embed`} 
                                      className="h-full flex-1 rounded-md border"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-full flex-1 bg-muted rounded-md flex flex-col items-center justify-center text-[10px] text-muted-foreground border">
                                      <MapPin className="w-4 h-4 mb-1" /> Sin GPS
                                    </div>
                                  )}
                                </div>
                                
                                {punch.note && (
                                  <div className="text-xs text-muted-foreground italic mt-1 bg-muted/30 p-1.5 rounded border">
                                    "{punch.note}"
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
  );
}
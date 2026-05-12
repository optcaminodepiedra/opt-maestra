"use client";

import React, { useState, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, Clock, ChevronDown, ChevronUp, CheckCircle, Trash2, X,
} from "lucide-react";
import { approveWorkDay, deleteWorkDay } from "@/lib/payroll.actions";

const TZ = "America/Mexico_City";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Formatea una fecha @db.Date (string "YYYY-MM-DD" del server) sin caer
 * en problemas de zona horaria.
 */
function formatDateMx(d: string | Date | null | undefined): string {
  if (!d) return "—";
  let year: number, month: number, day: number;

  if (typeof d === "string") {
    const isoPart = d.slice(0, 10);
    [year, month, day] = isoPart.split("-").map(Number);
  } else {
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }

  const tempDate = new Date(Date.UTC(year, month - 1, day));
  const diaSemana = DIAS_CORTOS[tempDate.getUTCDay()];
  const mesNombre = MESES_CORTOS[month - 1];
  return `${diaSemana} ${String(day).padStart(2, "0")} ${mesNombre}`;
}

function formatTimeMx(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Suma horas trabajadas considerando múltiples entradas/salidas.
 * Pares ENTRADA → SALIDA. Si no hay SALIDA al final, no se cuenta esa entrada.
 */
function computeHours(punches: Array<{ type: string; timestamp: Date | string }>): string {
  let totalMs = 0;
  let lastEntrada: number | null = null;

  for (const p of punches) {
    const ts = typeof p.timestamp === "string" ? new Date(p.timestamp).getTime() : p.timestamp.getTime();
    if (p.type === "ENTRADA") {
      lastEntrada = ts;
    } else if (p.type === "SALIDA" && lastEntrada !== null) {
      totalMs += ts - lastEntrada;
      lastEntrada = null;
    }
  }

  if (totalMs === 0) return "—";
  const hrs = totalMs / (1000 * 60 * 60);
  return `${hrs.toFixed(1)} hrs`;
}

export default function PayrollTable({ records }: { records: any[] }) {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const handleApprove = async (id: string) => {
    if (!confirm("¿Aprobar este día de trabajo para nómina?")) return;
    setLoadingId(id);
    try {
      await approveWorkDay(id);
    } catch {
      alert("Error al aprobar.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("⚠️ ¿Eliminar definitivamente este registro?")) return;
    setLoadingId(id);
    try {
      await deleteWorkDay(id);
    } catch {
      alert("Error al eliminar.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium w-48">Empleado</th>
                  <th className="px-6 py-4 font-medium w-32">Fecha / Estado</th>
                  <th className="px-6 py-4 font-medium">Resumen</th>
                  <th className="px-6 py-4 font-medium text-right w-52">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((day) => {
                  const isExpanded = expandedRows.includes(day.id);
                  const isLoading = loadingId === day.id;
                  const numPunches = day.punches.length;
                  const horas = computeHours(day.punches);
                  const entradas = day.punches.filter((p: any) => p.type === "ENTRADA").length;
                  const salidas = day.punches.filter((p: any) => p.type === "SALIDA").length;

                  return (
                    <Fragment key={day.id}>
                      <tr className={`hover:bg-muted/10 transition-colors ${isExpanded ? "bg-muted/5" : ""} ${isLoading ? "opacity-50" : ""}`}>
                        <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => toggleRow(day.id)}>
                          <div className="text-base">{day.user?.fullName || "Sin nombre"}</div>
                          <div className="text-xs text-muted-foreground font-normal">{day.user?.email || "Sin correo"}</div>
                        </td>

                        <td className="px-6 py-4 cursor-pointer" onClick={() => toggleRow(day.id)}>
                          <div className="font-medium mb-1 whitespace-nowrap">
                            {formatDateMx(day.date)}
                          </div>
                          {day.status === "OPEN" && <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">En Turno</Badge>}
                          {day.status === "NEEDS_REVIEW" && <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">Revisar</Badge>}
                          {day.status === "APPROVED" && <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Aprobado</Badge>}
                        </td>

                        <td className="px-6 py-4 cursor-pointer" onClick={() => toggleRow(day.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-lg text-primary">{horas}</span>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {entradas} entradas
                            </Badge>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {salidas} salidas
                            </Badge>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {day.status === "NEEDS_REVIEW" && (
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(day.id)} disabled={isLoading}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(day.id)} disabled={isLoading}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleRow(day.id)}>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>

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
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${punch.type === "ENTRADA" ? "text-green-700 bg-green-100" : "text-orange-700 bg-orange-100"}`}>
                                      {punch.type}
                                    </span>
                                    <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                                      <Clock className="w-3.5 h-3.5" />
                                      {formatTimeMx(punch.timestamp)}
                                    </span>
                                  </div>

                                  <div className="flex gap-2 h-24 mt-1">
                                    {punch.photoUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={punch.photoUrl}
                                        alt="Evidencia"
                                        className="h-full w-20 object-cover rounded-md border cursor-pointer hover:opacity-80"
                                        onClick={() => setSelectedImage(punch.photoUrl)}
                                      />
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
                    </Fragment>
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

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <button
              className="absolute -top-12 right-0 text-white/70 hover:text-white p-2"
              onClick={() => setSelectedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Evidencia ampliada"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

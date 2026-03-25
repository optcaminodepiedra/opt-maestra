"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";
import { togglePeriodLock } from "@/lib/accounting.actions";

export default function PeriodsTable({ months, userName }: { months: any[], userName: string }) {
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);

  const handleToggle = async (monthNum: number, year: number, currentlyClosed: boolean) => {
    const actionName = currentlyClosed ? "REABRIR" : "CERRAR DEFINITIVAMENTE";
    if (!confirm(`¿Estás seguro de que deseas ${actionName} este mes?`)) return;

    setLoadingMonth(monthNum);
    try {
      await togglePeriodLock(year, monthNum, !currentlyClosed, userName);
    } catch (error) {
      alert("Error al cambiar el estado del periodo.");
    } finally {
      setLoadingMonth(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Mes</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium">Auditoría</th>
                <th className="px-6 py-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {months.map((m) => (
                <tr key={m.month} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-base">
                    {m.name}
                  </td>
                  
                  <td className="px-6 py-4">
                    {m.isClosed ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <Lock className="w-3 h-3 mr-1" /> Cerrado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Unlock className="w-3 h-3 mr-1" /> Abierto
                      </Badge>
                    )}
                  </td>

                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {m.isClosed && m.closedBy ? (
                      <>
                        <div className="font-semibold text-foreground">Bloqueado por: {m.closedBy}</div>
                        <div>{new Date(m.closedAt).toLocaleDateString("es-MX")}</div>
                      </>
                    ) : (
                      "Permite registrar ingresos y egresos"
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Button 
                      size="sm" 
                      variant={m.isClosed ? "outline" : "default"}
                      className={!m.isClosed ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                      disabled={loadingMonth === m.month}
                      onClick={() => handleToggle(m.month, m.year, m.isClosed)}
                    >
                      {loadingMonth === m.month ? "Guardando..." : (m.isClosed ? "Reabrir Mes" : "Bloquear Mes")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
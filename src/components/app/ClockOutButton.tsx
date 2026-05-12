"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Clock } from "lucide-react";
import ClockInBlocker from "@/app/app/ClockInBlocker";
import { getClockStatus } from "@/lib/payroll.actions";

type Props = {
  userName: string;
  userId: string;
};

/**
 * Botón flotante para hacer SALIDA cuando ya hay turno abierto.
 *
 * - Muestra el último estado (ENTRADA o SALIDA) en una mini-etiqueta
 * - Al hacer click, abre el modal de ClockInBlocker en modo "SALIDA"
 *   (o "ENTRADA" si el último fue SALIDA — vuelta de descanso)
 */
export default function ClockOutButton({ userName, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [nextType, setNextType] = useState<"ENTRADA" | "SALIDA">("SALIDA");
  const [lastPunchType, setLastPunchType] = useState<string | null>(null);

  // Refrescar estado cada minuto y al montar
  useEffect(() => {
    const refresh = async () => {
      try {
        const s = await getClockStatus(userId);
        setNextType(s.nextActionType);
        setLastPunchType(s.lastPunchType);
      } catch {
        // silencioso
      }
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [userId]);

  if (open) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <ClockInBlocker
            userName={userName}
            userId={userId}
            expectedType={nextType}
            allowCancel
            onCancel={() => setOpen(false)}
          />
        </div>
      </div>
    );
  }

  const isExit = nextType === "SALIDA";
  const label = isExit ? "Marcar salida" : "Volver a entrar";
  const color = isExit ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700";

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Button
        size="lg"
        className={`shadow-lg ${color} text-white rounded-full h-14 px-5`}
        onClick={() => setOpen(true)}
      >
        {isExit ? <LogOut className="w-5 h-5 mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{isExit ? "Salir" : "Entrar"}</span>
      </Button>
      {lastPunchType && (
        <div className="text-[10px] mt-1 text-center bg-black/60 text-white rounded-full px-2 py-0.5">
          Último: {lastPunchType}
        </div>
      )}
    </div>
  );
}

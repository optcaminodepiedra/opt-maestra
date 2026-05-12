"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Camera, RefreshCw, Loader2, LogIn, LogOut, AlertCircle,
} from "lucide-react";
import { forceClockIn, closeWorkDay } from "@/lib/payroll.actions";

type Props = {
  userName: string;
  userId: string;
  // Tipo que se espera registrar
  expectedType: "ENTRADA" | "SALIDA";
  // Si es una SALIDA desde un botón flotante, permitir cancelar para volver atrás
  allowCancel?: boolean;
  onCancel?: () => void;
};

export default function ClockInBlocker({
  userName, userId, expectedType, allowCancel, onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);

  const isExit = expectedType === "SALIDA";

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot({ quality: 0.5 });
      setImgSrc(image);
    }
  }, []);

  const handlePunch = async () => {
    if (!imgSrc) return;
    setLoading(true);
    setError(null);

    const submitPunch = async (lat?: number, lng?: number) => {
      try {
        const result = await forceClockIn(userId, lat, lng, imgSrc, notes);

        // Si fue SALIDA, también cerramos el WorkDay
        if (result.type === "SALIDA") {
          await closeWorkDay(userId);
        }

        window.location.reload();
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al registrar. Inténtalo de nuevo.");
        setLoading(false);
      }
    };

    // GPS con timeout corto
    if (!navigator.geolocation) {
      await submitPunch();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => submitPunch(pos.coords.latitude, pos.coords.longitude),
      () => submitPunch(), // sin GPS si falla
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const labelTitulo = isExit ? "Registro de Salida" : "Registro de Asistencia";
  const labelBoton = isExit ? "Confirmar Salida" : "Confirmar Entrada";
  const colorBoton = isExit ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700";
  const IconoBoton = isExit ? LogOut : LogIn;
  const labelNota = isExit ? "Notas del cierre (opcional)" : "Actividad actual";
  const placeholderNota = isExit ? "¿Algo que reportar?" : "¿Qué vas a hacer?";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-t-4 border-t-primary">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{labelTitulo}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isExit ? `Cerrar turno de ${userName}` : `Bienvenido, ${userName}`}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Cámara o preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-200">
            {!imgSrc ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/webp"
                  videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                  className="w-full h-full object-cover"
                />
                <Button
                  onClick={capture}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full h-12 w-12"
                  variant="secondary"
                >
                  <Camera />
                </Button>
              </>
            ) : (
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc} alt="captura" className="h-full w-full object-cover" />
                <Button
                  onClick={() => setImgSrc(null)}
                  className="absolute top-2 right-2 rounded-full h-8 w-8 p-0"
                  variant="destructive"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="text-left space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">{labelNota}</label>
            <textarea
              className="w-full p-2 border rounded-md text-sm"
              rows={2}
              placeholder={placeholderNota}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Botón principal */}
          <Button
            size="lg"
            className={`w-full h-14 ${colorBoton}`}
            onClick={handlePunch}
            disabled={loading || !imgSrc}
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <IconoBoton className="w-5 h-5 mr-2" />
                {labelBoton}
              </>
            )}
          </Button>

          {/* Botón cancelar (solo en SALIDA desde botón flotante) */}
          {allowCancel && onCancel && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar y volver
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

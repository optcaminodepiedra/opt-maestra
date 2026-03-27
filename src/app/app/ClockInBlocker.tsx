"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Camera, RefreshCw, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { forceClockIn } from "@/lib/payroll.actions";

export default function ClockInBlocker({ userName, userId }: { userName: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      // Calidad 0.5 en WEBP es nítida y ligera
      const image = webcamRef.current.getScreenshot({ quality: 0.5 });
      setImgSrc(image);
    }
  }, []);

  const handleClockIn = async () => {
    if (!imgSrc) return;
    setLoading(true);

    // Obtenemos GPS antes de disparar la acción
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // ENVIAMOS TODO: Foto real, GPS y Notas
          await forceClockIn(userId, pos.coords.latitude, pos.coords.longitude, imgSrc, notes);
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert("Error al registrar entrada. Revisa la consola.");
          setLoading(false);
        }
      },
      async (err) => {
        try {
          // Si el GPS falla, registramos solo foto y notas
          await forceClockIn(userId, undefined, undefined, imgSrc, notes);
          window.location.reload();
        } catch (retryErr) {
          alert("Error de servidor.");
          setLoading(false);
        }
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-t-4 border-t-primary">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <h1 className="text-2xl font-bold">Registro de Asistencia</h1>
          
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
                <Button onClick={capture} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full h-12 w-12" variant="secondary">
                  <Camera />
                </Button>
              </>
            ) : (
              <div className="relative h-full w-full">
                <img src={imgSrc} className="h-full w-full object-cover" />
                <Button onClick={() => setImgSrc(null)} className="absolute top-2 right-2 rounded-full h-8 w-8 p-0" variant="destructive">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="text-left space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">Actividad actual</label>
            <textarea 
              className="w-full p-2 border rounded-md text-sm"
              rows={2}
              placeholder="¿Qué vas a hacer?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button 
            size="lg" 
            className="w-full h-14 bg-green-600 hover:bg-green-700" 
            onClick={handleClockIn}
            disabled={loading || !imgSrc}
          >
            {loading ? <Loader2 className="animate-spin" /> : "Confirmar Check-In"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
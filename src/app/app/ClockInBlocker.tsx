"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"; // Asegúrate de tener este componente de shadcn
import { Textarea } from "@/components/ui/textarea"; // O usa un <textarea> estándar
import { Clock, MapPin, Camera, RefreshCw, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { forceClockIn } from "@/lib/payroll.actions";

export default function ClockInBlocker({ userName, userId }: { userName: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [notes, setNotes] = useState(""); // <--- ESTADO PARA LAS NOTAS
  const webcamRef = useRef<Webcam>(null);

  // Capturar foto de la webcam
const capture = useCallback(() => {
  // screenshotQuality: 0.5 reduce el peso de la imagen a la mitad sin perder mucha vista
  const imageSrc = webcamRef.current?.getScreenshot({ quality: 0.5 }); 
  if (imageSrc) setImgSrc(imageSrc);
}, [webcamRef]);

const handleClockIn = () => {
  if (!imgSrc) return alert("Por favor, tómate una foto primero.");
  setLoading(true);
  
  const processClockIn = async (lat?: number, lng?: number) => {
    try {
      // Intentamos el envío
      const result = await forceClockIn(userId, lat, lng, imgSrc, notes);
      if (result) {
        // Si todo sale bien, refrescamos
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Error detallado:", error);
      alert("Error del servidor: La foto es muy pesada o hay un problema de conexión.");
      setLoading(false);
    }
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => processClockIn(pos.coords.latitude, pos.coords.longitude),
      () => processClockIn()
    );
  } else {
    processClockIn();
  }
};

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-t-4 border-t-primary overflow-hidden">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 flex items-center justify-center rounded-full text-primary">
            <Clock className="w-6 h-6" />
          </div>
          
          <div>
            <h1 className="text-xl font-bold">¡Hola, {userName}!</h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Es necesario registrar tu foto, ubicación y actividad para entrar.
            </p>
          </div>

          {/* ÁREA DE CÁMARA / PREVIEW */}
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner border-2 border-muted">
            {!imgSrc ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="w-full h-full object-cover"
                />
                <Button 
                  onClick={capture}
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full h-12 w-12 shadow-lg border-2 border-white"
                >
                  <Camera className="w-6 h-6" />
                </Button>
              </>
            ) : (
              <div className="relative w-full h-full">
                <img src={imgSrc} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="text-white w-12 h-12 drop-shadow-md" />
                </div>
                <Button 
                  onClick={() => setImgSrc(null)}
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 rounded-full h-8 w-8 p-0"
                  disabled={loading}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* CAMPO DE NOTAS */}
          <div className="space-y-2 text-left bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Actividad / Notas
              </Label>
            </div>
            <textarea 
              className="w-full p-2 text-sm border rounded-md bg-white focus:ring-2 focus:ring-primary outline-none resize-none transition-all border-slate-300"
              placeholder="Nota de actividad (¿Qué harás hoy? ¿Alguna observación?)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="bg-blue-50 p-2 rounded-lg flex items-center justify-center gap-2 text-blue-700 text-[10px] font-medium uppercase tracking-wider">
            <MapPin className="w-3 h-3" />
            Ubicación GPS Requerida
          </div>

          <div className="space-y-3">
            {!imgSrc ? (
              <p className="text-sm font-medium text-orange-600 animate-pulse">
                Primero toma tu foto para habilitar el registro
              </p>
            ) : (
              <Button 
                size="lg" 
                className="w-full text-lg h-14 bg-green-600 hover:bg-green-700 shadow-md transition-all active:scale-95" 
                onClick={handleClockIn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando registro...
                  </>
                ) : (
                  "Confirmar y Enviar Check"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
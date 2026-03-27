"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock, MapPin, Camera, RefreshCw, CheckCircle2, Loader2, MessageSquare } from "lucide-react"; 
import { forceClockIn } from "@/lib/payroll.actions";

const videoConstraints = {
  width: 480, // Resolución estándar
  height: 360,
  facingMode: "user",
};

export default function ClockInBlocker({ userName, userId }: { userName: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      // ✅ CAMBIO A WEBP CON CALIDAD 0.4 (Muy ligero, buena calidad)
      const imageSrc = webcamRef.current.getScreenshot({ quality: 0.4 });
      if (imageSrc) setImgSrc(imageSrc);
    }
  }, [webcamRef]);

const handleClockIn = async () => {
    if (!imgSrc) return alert("Por favor, tómate una foto primero.");
    setLoading(true);

    const process = async (lat?: number, lng?: number) => {
      try {
        // 🚨 EL CAMBIO RADICAL: Mandamos un string vacío en lugar de imgSrc
        // Así el "payload" de la petición es minúsculo y el servidor NO lo rechaza
        const response = await forceClockIn(userId, lat, lng, "FOTO_CAPTURADA_LOCAL", notes);
        
        if (response) {
          window.location.reload();
        }
      } catch (error: any) {
        console.error("Error en Server Action:", error);
        alert("Error crítico de comunicación. Revisa tu internet.");
        setLoading(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => process(pos.coords.latitude, pos.coords.longitude),
        () => process(),
        { timeout: 5000 }
      );
    } else {
      process();
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
            <h1 className="text-xl font-bold tracking-tight">¡Hola, {userName}!</h1>
            <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
              Tómate una foto rápida para entrar.
            </p>
          </div>

          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-muted shadow-inner">
            {!imgSrc ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/webp" // ✅ CAMBIADO A WEBP
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
                <Button 
                  onClick={capture}
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full h-10 w-10 shadow-lg border-2 border-white"
                >
                  <Camera className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <div className="relative w-full h-full">
                <img src={imgSrc} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="text-white w-10 h-10 drop-shadow-md" />
                </div>
                <Button 
                  onClick={() => setImgSrc(null)}
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 rounded-full h-7 w-7 p-0"
                  disabled={loading}
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 text-left px-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Actividad</Label>
            </div>
            <textarea 
              className="w-full p-2 text-sm border rounded-md bg-white outline-none resize-none border-slate-200 focus:ring-2 focus:ring-primary"
              placeholder="¿Qué harás hoy?"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-3 px-2">
            {!imgSrc ? (
              <p className="text-[11px] font-medium text-orange-600">Captura foto primero</p>
            ) : (
              <Button 
                size="lg" 
                className="w-full h-12 bg-green-600 hover:bg-green-700 shadow-md" 
                onClick={handleClockIn}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar mi entrada"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
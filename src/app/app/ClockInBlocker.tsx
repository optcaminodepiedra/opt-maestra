"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam"; // Si no tienes instalada esta librería, corre: npm install react-webcam
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, MapPin, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { forceClockInWithPhoto } from "@/lib/payroll.actions";

export default function ClockInBlocker({ userName, userId }: { userName: string, userId: string }) {
  const webcamRef = useRef<Webcam>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Configuración de la cámara
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user" // Usa la cámara frontal (ideal para selfies de checado)
  };

  // 1. CAPTURAR FOTO Y UBICACIÓN
  const handleCapture = useCallback(() => {
    setStatus("idle");
    setErrorMsg("");
    
    // Capturamos la foto desde la webcam
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setPhotoBase64(imageSrc);
    } else {
      setStatus("error");
      setErrorMsg("No se pudo activar la cámara o tomar la foto.");
      return;
    }

    // Pedimos la ubicación GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setStatus("ready"); // Foto y GPS listos
        },
        (error) => {
          // Si el GPS falla, dejamos que chequen pero avisamos
          console.error("Error GPS:", error);
          setStatus("ready"); // Procedemos sin GPS si es necesario
        }
      );
    } else {
      setStatus("ready"); // Procedemos sin GPS
    }
  }, [webcamRef]);

  // 2. CONFIRMAR Y SUBIR EL CHECK
  const handleConfirmClockIn = async () => {
    if (!photoBase64) return;
    setStatus("saving");

    try {
      await forceClockInWithPhoto(
        userId, 
        photoBase64, 
        location?.lat, 
        location?.lng
      );
      setStatus("success");
      
      // Pequeño delay para que vean el check verde antes de que cargue el sistema
      setTimeout(() => {
        window.location.reload(); // Recargamos para que el layout los deje pasar
      }, 1500);

    } catch (error: any) {
      console.error(error);
      setStatus("error");
      setErrorMsg(error.message || "Hubo un error al guardar tu asistencia.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            ¡Hola, {userName}!
          </CardTitle>
          <CardDescription className="text-base text-slate-700 font-semibold mt-2">
            Necesitamos registrar tu entrada para darte acceso al sistema.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 bg-white">
            <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-slate-800">
              <Camera className="w-5 h-5 text-slate-500" />
              Tómate una foto para el registro (Selfie)
            </h4>

            {status === "idle" || status === "error" || !photoBase64 ? (
              // VISTA DE LA CÁMARA EN VIVO
              <div className="relative rounded-md overflow-hidden aspect-video bg-black">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              // PREVIEW DE LA FOTO CAPTURADA
              <div className="relative rounded-md overflow-hidden aspect-video border-2 border-green-500 bg-black">
                <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1 shadow">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            )}
          </div>

          {/* INDICADOR DE GPS */}
          <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg border">
            <MapPin className={`w-6 h-6 ${location ? 'text-green-600' : 'text-slate-400'}`} />
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800">Validación Geográfica (GPS)</div>
              <div className="text-xs text-muted-foreground">
                {location 
                  ? `Ubicación capturada: [${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}]` 
                  : 'Obteniendo ubicación...'
                }
              </div>
            </div>
            {!location && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>

          {/* MENSAJES DE ERROR O ÉXITO */}
          {status === "error" && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm flex items-center gap-2 font-medium">
              <AlertTriangle className="w-5 h-5" />
              {errorMsg}
            </div>
          )}
          {status === "success" && (
            <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5" />
              ¡Asistencia registrada con éxito! Cargando el sistema...
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t pt-4">
          {/* BOTÓN 1: TOMAR O REPETIR FOTO */}
          <Button 
            variant={photoBase64 ? "outline" : "default"} 
            className="w-full h-12 text-base font-semibold"
            onClick={handleCapture}
            disabled={status === "saving" || status === "success"}
          >
            <Camera className="w-5 h-5 mr-2" />
            {photoBase64 ? "Repetir Foto" : "Tómame la Foto Ahora"}
          </Button>

          {/* BOTÓN 2: CONFIRMAR CHECADO */}
          {photoBase64 && (
            <Button 
              className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
              onClick={handleConfirmClockIn}
              disabled={status === "saving" || status === "success"}
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  CONFIRMAR Y SUBIR MI CHECK
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
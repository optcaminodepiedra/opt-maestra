"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerTimePunch } from "@/lib/timeclock.actions";

// Define PunchType locally since it's not exported from @prisma/client
type PunchType = "ENTRADA" | "SALIDA" | "INICIO_COMIDA" | "FIN_COMIDA";

export default function MobileClockPage() {
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [punchType, setPunchType] = useState<PunchType | null>(null);

  // Iniciar la cámara y obtener GPS al cargar
  useEffect(() => {
    startCamera();
    getLocation();
    return () => stopCamera(); // Apagar cámara al salir
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // "user" es frontal, "environment" es trasera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      toast.error("No se pudo acceder a la cámara. Revisa los permisos.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setIsCameraActive(false);
    }
  };

  const getLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast.error("Por favor activa tu GPS para checar.")
      );
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Comprimimos la imagen a JPEG calidad 0.7 para no saturar la base de datos
        const base64 = canvas.toDataURL("image/jpeg", 0.7);
        setPhoto(base64);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = async (type: PunchType) => {
    if (!photo) return toast.error("Debes tomarte la foto primero");
    if (!location) return toast.error("Esperando señal de GPS...");
    if (!session?.user?.email) return toast.error("Error de sesión");

    setLoading(true);
    setPunchType(type);

    try {
      await registerTimePunch({
        userId: session.user.email, // Use email as unique identifier
        type: type,
        photoBase64: photo,
        lat: location.lat,
        lng: location.lng,
        note: note,
        deviceType: "MOBILE",
      });

      toast.success(`¡${type} registrada con éxito!`);
      // Recargar para limpiar
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error(error.message || "Error al registrar");
    } finally {
      setLoading(false);
      setPunchType(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Reloj Checador</CardTitle>
          <p className="text-sm text-muted-foreground">Hola, {session?.user?.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* VISOR DE CÁMARA */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center border-2 border-muted">
            {!photo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={photo} alt="Evidencia" className="w-full h-full object-cover" />
            )}

            {/* Status del GPS Flotante */}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
              <MapPin className="w-3 h-3" />
              {location ? "GPS Activo" : "Buscando GPS..."}
            </div>
          </div>

          {/* BOTÓN CAPTURAR FOTO */}
          {!photo ? (
            <Button onClick={takePhoto} className="w-full h-12 text-lg" disabled={!isCameraActive}>
              <Camera className="mr-2 h-5 w-5" /> Tomar Foto Evidencia
            </Button>
          ) : (
            <Button onClick={retakePhoto} variant="outline" className="w-full">
              Volver a tomar foto
            </Button>
          )}

          {/* CAMPO DE NOTAS */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas (Opcional)</label>
            <Input 
              placeholder="Ej. Me mandaron a compras, cubriendo en Bodega 4..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* BOTONES DE REGISTRO */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button 
              variant="default" 
              className="bg-green-600 hover:bg-green-700 h-14"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("ENTRADA")}
            >
              {loading && punchType === "ENTRADA" ? <Loader2 className="animate-spin" /> : "ENTRADA"}
            </Button>

            <Button 
              variant="destructive" 
              className="h-14"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("SALIDA")}
            >
              {loading && punchType === "SALIDA" ? <Loader2 className="animate-spin" /> : "SALIDA"}
            </Button>

            <Button 
              variant="outline" 
              className="border-blue-200 hover:bg-blue-50 text-blue-700"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("INICIO_COMIDA")}
            >
              SALIDA COMIDA
            </Button>

            <Button 
              variant="outline" 
              className="border-blue-200 hover:bg-blue-50 text-blue-700"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("FIN_COMIDA")}
            >
              REGRESO COMIDA
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
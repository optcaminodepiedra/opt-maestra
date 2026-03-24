"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Loader2, CheckCircle2, AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerTimePunch } from "@/lib/timeclock.actions";
import { PunchType } from "@prisma/client";

export default function MobileClockPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para nuestra nueva pantalla de confirmación/error
  const [successState, setSuccessState] = useState<{ type: string; time: string } | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    getLocation();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setErrorState("No se pudo acceder a la cámara. Por favor, da los permisos necesarios en tu navegador.");
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
        (err) => setErrorState("No pudimos obtener tu ubicación. El GPS es obligatorio para checar.")
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
        setPhoto(canvas.toDataURL("image/jpeg", 0.7));
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSubmit = async (type: PunchType) => {
    if (!photo) return setErrorState("Debes tomarte la foto de evidencia primero.");
    if (!location) return setErrorState("Aún no tenemos tu ubicación GPS.");
    
    // Verificamos que tengamos tu correo en la sesión actual
    if (!session?.user?.email) return setErrorState("No hay una sesión activa con tu correo.");

    setLoading(true);
    setErrorState(null);

    try {
      // Mandamos tu correo al servidor
      await registerTimePunch({
        userEmail: session.user.email,
        type: type,
        photoBase64: photo,
        lat: location.lat,
        lng: location.lng,
        note: note,
        deviceType: "MOBILE",
      });

      setSuccessState({
        type: type,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      });

    } catch (error: any) {
      setErrorState(error.message || "Ocurrió un error al registrar en la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // PANTALLA DE ÉXITO
  // ==========================================
  if (successState) {
    return (
      <div className="max-w-md mx-auto p-4 mt-10">
        <Card className="shadow-2xl border-green-500/20 text-center animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 pb-10 space-y-6">
            <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-green-700">¡Registro Exitoso!</h2>
              <p className="text-lg text-muted-foreground">
                Se marcó tu <strong>{successState.type}</strong> a las {successState.time}.
              </p>
            </div>
            <Button 
              className="w-full h-14 text-lg mt-4" 
              onClick={() => router.push("/app")}
            >
              <Home className="mr-2 h-5 w-5" /> Regresar al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==========================================
  // PANTALLA PRINCIPAL DE CAPTURA
  // ==========================================
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Reloj Checador</CardTitle>
          <p className="text-sm text-muted-foreground">Hola, {session?.user?.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* ALERTA DE ERROR */}
          {errorState && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start gap-2 text-sm animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Error en el registro</p>
                <p>{errorState}</p>
              </div>
            </div>
          )}

          {/* VISOR DE CÁMARA */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center border-2 border-muted">
            {!photo ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={photo} alt="Evidencia" className="w-full h-full object-cover" />
            )}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
              <MapPin className="w-3 h-3" />
              {location ? "GPS Activo" : "Buscando GPS..."}
            </div>
          </div>

          {!photo ? (
            <Button onClick={takePhoto} className="w-full h-12 text-lg" disabled={!isCameraActive}>
              <Camera className="mr-2 h-5 w-5" /> Tomar Foto
            </Button>
          ) : (
            <Button onClick={retakePhoto} variant="outline" className="w-full">
              Volver a tomar foto
            </Button>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notas (Opcional)</label>
            <Input 
              placeholder="Ej. Fui por insumos..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* BOTONES */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button 
              className="bg-green-600 hover:bg-green-700 h-14 font-bold text-lg"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("ENTRADA")}
            >
              {loading ? <Loader2 className="animate-spin" /> : "ENTRADA"}
            </Button>
            <Button 
              variant="destructive" 
              className="h-14 font-bold text-lg"
              disabled={!photo || !location || loading}
              onClick={() => handleSubmit("SALIDA")}
            >
              {loading ? <Loader2 className="animate-spin" /> : "SALIDA"}
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
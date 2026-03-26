"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin } from "lucide-react";
import { forceClockIn } from "@/lib/payroll.actions";

export default function ClockInBlocker({ userName, userId }: { userName: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("Obteniendo ubicación...");

  const handleClockIn = () => {
    setLoading(true);
    
    // Intentamos obtener el GPS del celular/compu
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await forceClockIn(userId, position.coords.latitude, position.coords.longitude);
            // La página se recargará sola gracias al revalidatePath del servidor
          } catch (error) {
            alert("Error al registrar entrada.");
            setLoading(false);
          }
        },
        async (error) => {
          // Si rechazan el GPS, los dejamos checar pero sin coordenadas (puedes cambiar esto para obligarlos)
          alert("No pudimos obtener tu ubicación, pero registraremos tu entrada.");
          await forceClockIn(userId);
        }
      );
    } else {
      forceClockIn(userId); // Si el navegador no soporta GPS
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-t-4 border-t-primary">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 flex items-center justify-center rounded-full text-primary">
            <Clock className="w-8 h-8" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight">¡Hola, {userName}!</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Por seguridad y control de nómina, necesitas registrar tu entrada antes de acceder al sistema de operación.
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-center gap-2 text-blue-700 text-xs font-medium">
            <MapPin className="w-4 h-4" />
            Se registrará tu ubicación actual
          </div>

          <Button 
            size="lg" 
            className="w-full text-lg h-14 bg-primary hover:bg-primary/90" 
            onClick={handleClockIn}
            disabled={loading}
          >
            {loading ? "Registrando..." : "Checar Entrada Ahora"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch"; // Asegúrate de tener instalado el switch de shadcn
import { Label } from "@/components/ui/label";
import { toggleUserClockIn } from "@/lib/payroll.actions";

export default function UserClockInToggle({ userId, initialStatus }: { userId: string, initialStatus: boolean }) {
  const [enabled, setEnabled] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    setEnabled(checked); // Actualizamos la UI instantáneamente
    
    try {
      await toggleUserClockIn(userId, checked);
    } catch (error) {
      alert("Error al actualizar la configuración del usuario.");
      setEnabled(!checked); // Si falla, lo regresamos a como estaba
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id={`clockin-${userId}`} 
        checked={enabled} 
        onCheckedChange={handleToggle} 
        disabled={loading}
      />
      <Label htmlFor={`clockin-${userId}`} className="text-xs text-muted-foreground cursor-pointer">
        {enabled ? "Obligatorio" : "Opcional"}
      </Label>
    </div>
  );
}
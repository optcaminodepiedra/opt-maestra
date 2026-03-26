"use client";

import { useState } from "react";
import { toggleUserClockIn } from "@/lib/payroll.actions";
import { Label } from "@/components/ui/label";

export default function UserClockInToggle({ userId, initialStatus }: { userId: string, initialStatus: boolean }) {
  const [enabled, setEnabled] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setLoading(true);
    setEnabled(isChecked); // Actualizamos la vista rápido
    
    try {
      await toggleUserClockIn(userId, isChecked);
    } catch (error) {
      alert("Error al actualizar la configuración.");
      setEnabled(!isChecked); // Regresamos si hay error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-muted/30 px-3 py-2 rounded-lg border">
      <Label htmlFor={`clockin-${userId}`} className={`text-xs font-bold cursor-pointer ${enabled ? 'text-green-700' : 'text-muted-foreground'}`}>
        {enabled ? "OBLIGATORIO" : "OPCIONAL"}
      </Label>
      
      {/* Usamos un checkbox nativo estilizado para no depender de librerías extra a esta hora */}
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          id={`clockin-${userId}`} 
          className="sr-only peer" 
          checked={enabled} 
          onChange={handleToggle}
          disabled={loading}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
      </label>
    </div>
  );
}
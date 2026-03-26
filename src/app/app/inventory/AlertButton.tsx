"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { requestRestock } from "@/lib/inventory.actions";

export default function AlertButton({ itemId, businessId, userId }: { itemId: string, businessId: string, userId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await requestRestock(itemId, businessId, userId);
      alert("¡Solicitud enviada a Almacén con éxito!");
    } catch (error: any) {
      alert(error.message || "Error al solicitar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      size="sm" 
      onClick={handleRequest} 
      disabled={loading}
      className="bg-orange-600 hover:bg-orange-700 text-white"
    >
      <PlusCircle className="w-4 h-4 mr-1" />
      {loading ? "Enviando..." : "Pedir"}
    </Button>
  );
}
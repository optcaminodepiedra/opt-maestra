"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReservation } from "@/lib/hotel.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, CreditCard, Users, UserRound } from "lucide-react";

export default function NewReservationForm({ boot, userId }: { boot: any; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario
  const [formData, setFormData] = useState({
    businessId: boot.businessId || "",
    roomId: "",
    checkIn: "",
    checkOut: "",
    guestFullName: "",
    guestPhone: "",
    guestEmail: "",
    guestDocumentId: "",
    adults: 1,
    children: 0,
    total: "",
    deposit: "",
    note: ""
  });

  // Filtramos las habitaciones según la unidad de negocio seleccionada
  const availableRooms = boot.rooms?.filter((r: any) => r.businessId === formData.businessId) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createReservation({
        businessId: formData.businessId,
        roomId: formData.roomId,
        userId: userId,
        guestFullName: formData.guestFullName,
        guestPhone: formData.guestPhone,
        guestEmail: formData.guestEmail,
        guestDocumentId: formData.guestDocumentId,
        // Convertimos las fechas locales a formato ISO agregando una hora estándar (15:00 checkin, 12:00 checkout)
        checkIn: new Date(`${formData.checkIn}T15:00:00`).toISOString(),
        checkOut: new Date(`${formData.checkOut}T12:00:00`).toISOString(),
        adults: formData.adults,
        children: formData.children,
        total: Number(formData.total),
        deposit: Number(formData.deposit) || 0,
        note: formData.note
      });

      // Si todo sale bien, lo mandamos al Dashboard para que vea su nueva reserva
      router.push("/app/hotel/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al crear la reservación.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 font-medium">
          {error}
        </div>
      )}

      {/* SECCIÓN 1: ESTANCIA */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <CalendarDays className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold">Datos de la Estancia</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidad / Propiedad</Label>
              <Select 
                value={formData.businessId} 
                onValueChange={(v) => setFormData({ ...formData, businessId: v, roomId: "" })}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger>
                <SelectContent>
                  {boot.businesses.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Habitación</Label>
              <Select value={formData.roomId} onValueChange={(v) => setFormData({ ...formData, roomId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona habitación" /></SelectTrigger>
                <SelectContent>
                  {availableRooms.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.roomType?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Entrada (Check-in)</Label>
              <Input type="date" required value={formData.checkIn} onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Salida (Check-out)</Label>
              <Input type="date" required value={formData.checkOut} onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 2: HUÉSPED */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <UserRound className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold">Titular de la Reserva</h2>
          </div>

          <div className="space-y-2">
            <Label>Nombre Completo *</Label>
            <Input required placeholder="Ej. Juan Pérez" value={formData.guestFullName} onChange={(e) => setFormData({ ...formData, guestFullName: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input placeholder="10 dígitos" value={formData.guestPhone} onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input type="email" placeholder="correo@ejemplo.com" value={formData.guestEmail} onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Identificación (INE/Pasaporte)</Label>
              <Input placeholder="Opcional" value={formData.guestDocumentId} onChange={(e) => setFormData({ ...formData, guestDocumentId: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4"/> Adultos</Label>
              <Input type="number" min="1" required value={formData.adults} onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4"/> Niños</Label>
              <Input type="number" min="0" required value={formData.children} onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 3: TARIFAS Y NOTAS */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2 mb-4">
            <CreditCard className="text-primary w-5 h-5" />
            <h2 className="text-lg font-semibold">Tarifa y Cobro</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Costo Total de la Estancia (MXN) *</Label>
              <Input type="number" step="0.01" required placeholder="0.00" value={formData.total} onChange={(e) => setFormData({ ...formData, total: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Anticipo / Depósito Pagado (MXN)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={formData.deposit} onChange={(e) => setFormData({ ...formData, deposit: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>Notas Adicionales (Alergias, peticiones, etc.)</Label>
            <Textarea placeholder="Ej. Requiere cuna, check-in tardío..." value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" type="button" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !formData.roomId} className="bg-primary hover:bg-primary/90 px-8">
          {loading ? "Guardando..." : "Confirmar Reservación"}
        </Button>
      </div>
    </form>
  );
}
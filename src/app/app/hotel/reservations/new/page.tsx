import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getHotelBoot } from "@/lib/hotel.actions";
import NewReservationForm from "./NewReservationForm";

export default async function NewReservationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traemos los datos iniciales (hoteles, habitaciones disponibles, etc.)
  const boot = await getHotelBoot();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Reservación</h1>
        <p className="text-muted-foreground mt-1">
          Registra una nueva estancia, asigna la habitación y captura los datos del huésped.
        </p>
      </div>

      <NewReservationForm 
        boot={boot} 
        userId={(session.user as any).id} 
      />
    </div>
  );
}
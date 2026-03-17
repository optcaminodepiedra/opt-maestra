import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HotelReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reportes Hotel</h1>
      <p className="text-sm text-muted-foreground">
        Siguiente: rango de fechas + selector de negocio + ADR/RevPAR/ocupación/ingresos/no-shows/cancelaciones.
      </p>
    </div>
  );
}
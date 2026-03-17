import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HotelFolioPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Folio</h1>
        <p className="text-sm text-muted-foreground">
          Aquí vamos a ver el folio por reservación: cargos, depósitos, pagos y cierre contable.
        </p>
      </div>

      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Pendiente: selector de negocio + buscar por reservación/huésped + detalle del folio.
      </div>
    </div>
  );
}
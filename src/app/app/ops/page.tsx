import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function Ops() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Operación</h1>
      <p className="text-sm text-muted-foreground">
        Registrar venta, gasto rápido y cerrar turno.
      </p>
    </div>
  );
}

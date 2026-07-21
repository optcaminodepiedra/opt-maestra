import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UpcomingEventsCard } from "@/components/events/UpcomingEventsCard";

export default async function Manager() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard — Gerencia/Superior</h1>
        <p className="text-sm text-muted-foreground">
          Ventas hoy, gastos hoy, retiros pendientes, cortes.
        </p>
      </div>

      <UpcomingEventsCard />
    </div>
  );
}

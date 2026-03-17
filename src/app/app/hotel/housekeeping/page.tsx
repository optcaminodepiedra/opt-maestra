import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HotelHousekeepingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Housekeeping</h1>
      <p className="text-sm text-muted-foreground">
        Siguiente: lista por estados + “marcar limpia/sucia/en proceso”.
      </p>
    </div>
  );
}
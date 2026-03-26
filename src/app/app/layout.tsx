import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker"; // Importamos nuestro guardia

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // 1. OBTENEMOS AL USUARIO DE LA BASE DE DATOS
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  let needsToClockIn = false;

  // 2. LA NUEVA REGLA: Revisamos si este usuario en específico tiene prendido el switch
  if (user.requiresClockIn) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeShift = await prisma.workDay.findFirst({
      where: {
        userId: user.id,
        status: "OPEN",
        date: { gte: today }
      }
    });

    if (!activeShift) {
      needsToClockIn = true; // No tiene turno abierto = ¡Bloqueado!
    }
  }

  // 3. SI NECESITA CHECAR, LE CARGAMOS SOLO LA PANTALLA DE BLOQUEO
  if (needsToClockIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ClockInBlocker userName={user.fullName || "Usuario"} userId={user.id} />
      </div>
    );
  }

  // 4. SI YA CHECÓ (O SI TIENE EL SWITCH APAGADO), LE CARGAMOS EL SISTEMA NORMAL
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* TU CÓDIGO ACTUAL DEL SIDEBAR Y NAVBAR DEBERÍA IR AQUÍ ADENTRO */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
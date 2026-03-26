import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // 1. Obtenemos al usuario y su configuración de asistencia
  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { id: true, fullName: true, requiresClockIn: true }
  });

  if (!user) redirect("/login");

  let needsToClockIn = false;

  // 2. Verificamos si tiene el switch de "Obligatorio" prendido
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
      needsToClockIn = true; 
    }
  }

  // 3. SI NECESITA CHECAR: Bloqueamos TODO (Navbar y Sidebar incluidos)
  if (needsToClockIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ClockInBlocker userName={user.fullName || "Usuario"} userId={user.id} />
      </div>
    );
  }

  // 4. SI YA CHECÓ O ES OPCIONAL: Renderizamos el contenido normal
  // Aquí es donde tus sub-layouts o páginas inyectan el Sidebar/Navbar
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
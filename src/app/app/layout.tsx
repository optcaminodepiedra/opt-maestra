import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";

// Importaciones de tus componentes
import { Sidebar } from "@/components/app/Sidebar"; 
import { TopBar } from "@/components/app/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  // 1. Verificación de sesión
  if (!session?.user) redirect("/login");

  // 2. Obtenemos al usuario completo
  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { 
      id: true, 
      fullName: true, 
      requiresClockIn: true, 
      role: true,
      email: true,
      username: true,
      image: true // Por si el TopBar ocupa la foto
    }
  });

  if (!user) redirect("/login");

  // 3. Lógica del Reloj Checador
  let needsToClockIn = false;
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

  // 4. RENDERIZADO CON PASO DE DATOS (PARA EVITAR EL ERROR DEL .MAP)
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Probamos pasando la sesión y el usuario por si acaso uno de los dos es el que falta */}
      <Sidebar user={user as any} session={session} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* El TopBar suele pedir el usuario para mostrar el nombre/perfil */}
        <TopBar user={user as any} session={session} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {needsToClockIn ? (
            <div className="flex items-center justify-center h-[80vh]">
              <ClockInBlocker userName={user.fullName || "Usuario"} userId={user.id} />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
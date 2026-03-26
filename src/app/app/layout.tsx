import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";

// Importaciones según tu estructura de carpetas
import { Sidebar } from "@/components/app/Sidebar"; 
import { TopBar } from "@/components/app/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  
  // Si no hay sesión, al login de una
  if (!session?.user) redirect("/login");

  // 1. Obtenemos al usuario completo con los campos necesarios
  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { 
      id: true, 
      fullName: true, 
      requiresClockIn: true, 
      role: true,
      email: true,
      username: true 
    }
  });

  if (!user) redirect("/login");

  // 2. Lógica del Reloj Checador
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

  // 3. RENDERIZADO SEGURO
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Pasamos la sesión o el user a los componentes por si 
         ellos hacen el .map() basado en el rol del usuario 
      */}
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Pasamos el objeto user al TopBar por si necesita el nombre/email */}
        <TopBar />

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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";

// IMPORTA AQUÍ TUS COMPONENTES DE NAVBAR/SIDEBAR SI LOS TIENES APARTE
// import { Sidebar } from "@/components/nav/Sidebar"; 
// import { Navbar } from "@/components/nav/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // 1. Obtenemos los datos del usuario logueado
  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { id: true, fullName: true, requiresClockIn: true }
  });

  if (!user) redirect("/login");

  let needsToClockIn = false;

  // 2. Lógica del Reloj Checador
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

  // 3. RENDERIZADO DEL SISTEMA
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* AQUÍ DEBES PEGAR EL CÓDIGO DE TU SIDEBAR Y NAVBAR 
          PARA QUE SIEMPRE SE VEAN 
      */}
      
      {/* Ejemplo de estructura común: */}
      {/* <Sidebar /> */}
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* <Navbar user={user} /> */}
        
        <main className="flex-1 overflow-y-auto p-4">
          {needsToClockIn ? (
            // Si falta checar, el contenido central se bloquea
            <div className="flex items-center justify-center h-full">
              <ClockInBlocker userName={user.fullName || "Usuario"} userId={user.id} />
            </div>
          ) : (
            // Si todo está ok, cargamos la página solicitada
            children
          )}
        </main>
      </div>
    </div>
  );
}
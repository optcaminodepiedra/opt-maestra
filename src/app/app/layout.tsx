import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";
import { getNavByRole } from "@/lib/nav";

// IMPORTAMOS COMPONENTES DE NAVEGACIÓN
import { Sidebar } from "@/components/app/Sidebar"; 
import { TopBar } from "@/components/app/TopBar"; 
import { MobileSidebar } from "@/components/app/MobileSidebar"; 

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { id: true, fullName: true, requiresClockIn: true, role: true }
  });

  if (!user) redirect("/login");

  const navSections = getNavByRole(user.role);

  // ==========================================
  // ✅ LÓGICA DE RELOJ CHECADOR RESTAURADA
  // ==========================================
  let needsToClockIn = false;

  if (user.requiresClockIn) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscamos si el usuario ya tiene un turno abierto hoy
    const activeShift = await prisma.workDay.findFirst({
      where: {
        userId: user.id,
        status: "OPEN",
        date: { gte: today }
      }
    });

    // Si no hay turno abierto, se activa el bloqueador
    if (!activeShift) {
      needsToClockIn = true;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 1. SIDEBAR DESKTOP (Oculto en móvil) */}
      <div className="hidden md:flex h-full w-72 flex-col">
        <Sidebar sections={navSections} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 2. TOPBAR/NAVBAR */}
        <TopBar />

        {/* 3. MOBILE SIDEBAR (Solo visible en móvil) */}
        <div className="md:hidden">
            <MobileSidebar sections={navSections} />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {needsToClockIn ? (
            /* SI NECESITA CHECAR: BLOQUEAMOS EL CONTENIDO */
            <div className="flex items-center justify-center min-h-[70vh]">
              <ClockInBlocker userName={user.fullName || "Usuario"} userId={user.id} />
            </div>
          ) : (
            /* SI TODO OK: MOSTRAR LA PÁGINA */
            children
          )}
        </main>
      </div>
    </div>
  );
}
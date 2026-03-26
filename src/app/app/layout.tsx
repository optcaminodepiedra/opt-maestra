import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";

// Importamos tus componentes y la lógica de navegación
import { Sidebar } from "@/components/app/Sidebar"; 
import { TopBar } from "@/components/app/TopBar";
import { getNavByRole } from "@/lib/nav"; // <--- Esta función es clave

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { 
      id: true, 
      fullName: true, 
      requiresClockIn: true, 
      role: true,
    }
  });

  if (!user) redirect("/login");

  // 1. OBTENEMOS LAS SECCIONES QUE EL SIDEBAR NECESITA PARA EL .MAP()
  const navSections = getNavByRole(user.role);

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* LE PASAMOS LAS SECCIONES AL SIDEBAR PARA QUE NO TRUENE EL .MAP() */}
      <Sidebar sections={navSections} />

      <div className="flex flex-col flex-1 overflow-hidden">
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
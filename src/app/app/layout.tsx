import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";
import { getNavByRole } from "@/lib/nav";

// IMPORTAMOS AMBOS SIDEBARS
import { Sidebar } from "@/components/app/Sidebar"; // Versión Desktop
import { TopBar } from "@/components/app/TopBar"; // Versión Desktop/Mobile
import { MobileSidebar } from "@/components/app/MobileSidebar"; // Versión Mobile (Drawer)

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ 
    where: { id: (session as any).user.id },
    select: { id: true, fullName: true, requiresClockIn: true, role: true }
  });

  if (!user) redirect("/login");

  const navSections = getNavByRole(user.role);

  // Lógica del Reloj Checador (se mantiene igual)
  let needsToClockIn = false;
  // ... (tu lógica de clock-in) ...

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 1. SIDEBAR DESKTOP (hidden on mobile, flex on md+) */}
      <div className="hidden md:flex h-full w-72 flex-col">
        <Sidebar sections={navSections} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 2. TOPBAR/NAVBAR */}
        <TopBar />

        {/* 3. MOBILE SIDEBAR (Drawer que se abre con botón en TopBar) */}
        {/* Asegúrate de que este componente use la lógica de Drawer de Shadcn */}
        <div className="md:hidden">
            <MobileSidebar sections={navSections} />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {needsToClockIn ? (
            <div className="flex items-center justify-center h-[80vh]">
              <ClockInBlocker userName={user.fullName || "Usuario"} userId={userId} />
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClockInBlocker from "./ClockInBlocker";
import ClockOutButton from "@/components/app/ClockOutButton";
import { getNavByRole } from "@/lib/nav";
import { getClockStatus } from "@/lib/payroll.actions";

import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { MobileSidebar } from "@/components/app/MobileSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: (session as any).user.id },
    select: { id: true, fullName: true, requiresClockIn: true, role: true },
  });

  if (!user) redirect("/login");

  const navSections = getNavByRole(user.role);

  // ═══════════════════════════════════════════════════════════════
  // ✅ LÓGICA DE RELOJ CHECADOR
  //
  //  - Si el usuario NO requiere check-in → render normal
  //  - Si requiere y NO tiene turno abierto del día → ClockInBlocker (ENTRADA)
  //  - Si requiere y SÍ tiene turno abierto → render normal + botón "Salir" flotante
  // ═══════════════════════════════════════════════════════════════

  let needsToClockIn = false;
  let showClockOutButton = false;

  if (user.requiresClockIn) {
    const status = await getClockStatus(user.id);

    if (!status.hasOpenWorkDay) {
      // No tiene turno abierto del día → debe hacer ENTRADA
      needsToClockIn = true;
    } else {
      // Tiene turno abierto → puede trabajar normal, pero le mostramos botón "Salir"
      showClockOutButton = true;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex h-full w-72 flex-col">
        <Sidebar sections={navSections} />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />

        <div className="md:hidden">
          <MobileSidebar sections={navSections} />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
          {needsToClockIn ? (
            <div className="flex items-center justify-center min-h-[70vh]">
              <ClockInBlocker
                userName={user.fullName || "Usuario"}
                userId={user.id}
                expectedType="ENTRADA"
              />
            </div>
          ) : (
            <>
              {children}
              {/* Botón flotante de SALIDA si tiene turno abierto */}
              {showClockOutButton && (
                <ClockOutButton
                  userName={user.fullName || "Usuario"}
                  userId={user.id}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

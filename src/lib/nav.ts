import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AppIndexPage() {
  const session = await getServerSession(authOptions);

  // Si no hay sesión, lo pateamos al login
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;

  // ==========================================
  // EL POLICÍA DE TRÁNSITO (REDIRECCIONES)
  // ==========================================

  // 1. Dueños, Directores y Contadores van al Dashboard de Negocios
  if (["MASTER_ADMIN", "OWNER", "MANAGER_OPS", "ACCOUNTING"].includes(role)) {
    redirect("/app/owner");
  }

  // 2. Meseros y Capitanes van directo al Mapa de Mesas
  if (["STAFF_WAITER", "MANAGER_RESTAURANT"].includes(role)) {
    redirect("/app/restaurant/tables");
  }

  // 3. Cocina y Barra van directo a ver los tickets pendientes (KDS)
  if (["STAFF_KITCHEN", "STAFF_BAR"].includes(role)) {
    redirect("/app/restaurant/kds");
  }

  // 4. Hotel, Ventas y Reservas van al Calendario
  if (["MANAGER_HOTEL", "STAFF_RECEPTION", "SALES", "RESERVATIONS"].includes(role)) {
    redirect("/app/hotel/calendar");
  }

  // 5. Cajeros de la Tiendita van a su Punto de Venta directo
  if (role === "STAFF_STORE") {
    redirect("/app/store/pos");
  }

  // 6. Almacenistas van a su módulo de inventario
  if (role === "INVENTORY") {
    redirect("/app/inventory");
  }

  // 7. POR DEFECTO (Recamaristas, Mantenimiento, Guías, etc.)
  // Lo más útil para ellos es ver el Reloj Checador y sus tareas.
  redirect("/app/reloj");
}
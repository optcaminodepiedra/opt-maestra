import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AppEntry() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user.role as string;

  // Directivos y dueños
  if (role === "OWNER" || role === "MASTER_ADMIN") redirect("/app/owner");
  if (role === "SUPERIOR") redirect("/app/owner"); // Carlos y Fernanda ven el mismo dashboard que dueños

  // Contabilidad
  if (role === "ACCOUNTING") redirect("/app/accounting");

  // Almacén (Goyo — ve toda la operadora)
  if (role === "INVENTORY") redirect("/app/inventory");

  // Gerentes de restaurante (Judith, Saúl P)
  if (role === "MANAGER_RESTAURANT") redirect("/app/manager/restaurant");

  // Gerentes de hotel
  if (role === "MANAGER_HOTEL") redirect("/app/hotel");

  // Gerentes de rancho (Iris)
  if (role === "MANAGER_RANCH") redirect("/app/manager/ranch");

  // Gerentes de operadora (Claudia, Iris cuando aplique)
  if (role === "MANAGER_OPS") redirect("/app/manager/ops");

  // Roles legado
  if (role === "MANAGER") redirect("/app/manager/ops");

  // Todo el staff operativo: meseros, cocina, bar, recepción, experiencias, etc.
  redirect("/app/ops");
}
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AppEntry() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user.role as string;

  // Directivos y dueños
  if (role === "OWNER" || role === "MASTER_ADMIN") redirect("/app/owner");
  if (role === "SUPERIOR") redirect("/app/owner");

  // Contabilidad
  if (role === "ACCOUNTING") redirect("/app/accounting");

  // Almacén global (Goyo)
  if (role === "INVENTORY") redirect("/app/inventory");

  // Gerentes — namespace propio
  if (role === "MANAGER_OPS") redirect("/app/manager/ops");
  if (role === "MANAGER_RESTAURANT") redirect("/app/manager/restaurant");
  if (role === "MANAGER_RANCH") redirect("/app/manager/ranch");
  if (role === "MANAGER_HOTEL") redirect("/app/hotel");

  // Rol legado
  if (role === "MANAGER") redirect("/app/manager/ops");

  // Staff operativo
  redirect("/app/ops");
}

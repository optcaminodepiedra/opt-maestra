import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function AppEntry() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = (session as any).user.role as string;

  if (role === "OWNER" || role === "MASTER_ADMIN") redirect("/app/owner");
  if (role === "SUPERIOR" || role === "MANAGER") redirect("/app/manager");
  if (role === "ACCOUNTING") redirect("/app/accounting");

  redirect("/app/ops");
}

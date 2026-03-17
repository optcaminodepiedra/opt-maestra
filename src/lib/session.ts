import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function getMe() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autenticado");

  const u = (session as any).user || {};
  return {
    id: u.id as string,
    role: u.role as Role,
    username: u.username as string,
    primaryBusinessId: (u.primaryBusinessId ?? null) as string | null,
  };
}
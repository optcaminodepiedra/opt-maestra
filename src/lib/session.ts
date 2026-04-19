import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

const ROLES_GLOBALES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING", "INVENTORY"]

/**
 * Obtiene la sesión del usuario actual.
 * Si no hay sesión activa, redirige al login.
 * Úsalo así: const user = await requireSession()
 */
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  return session.user
}

/**
 * Alias de requireSession — mantiene compatibilidad con el código
 * existente que ya usa getMe() en admin.actions.ts y otras partes.
 * Úsalo así: const me = await getMe()
 */
export async function getMe() {
  return requireSession()
}

/**
 * Devuelve el filtro de negocios para consultas Prisma.
 * - null → el usuario ve TODOS los negocios (dueños, Rodrigo, contabilidad, inventario)
 * - string[] → solo ve esos businessId
 */
export function getBusinessFilter(
  user: { role: string; primaryBusinessId?: string | null }
): string[] | null {
  if (ROLES_GLOBALES.includes(user.role)) return null
  if (user.primaryBusinessId) return [user.primaryBusinessId]
  return []
}

/**
 * true si el usuario puede ver todos los negocios sin filtro.
 */
export function isGlobal(user: { role: string }): boolean {
  return ROLES_GLOBALES.includes(user.role)
}

/**
 * true si el usuario es gerente o nivel superior.
 */
export function isManager(user: { role: string }): boolean {
  return [
    "MASTER_ADMIN", "OWNER", "SUPERIOR",
    "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER",
  ].includes(user.role)
}
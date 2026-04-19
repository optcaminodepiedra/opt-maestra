/**
 * lib/session.ts
 *
 * Funciones de ayuda para obtener la sesión del usuario
 * en Server Components y API Routes de Next.js.
 *
 * USO en cualquier página (Server Component):
 *
 *   import { requireSession, getBusinessFilter } from "@/lib/session"
 *
 *   export default async function MiPagina() {
 *     const user = await requireSession()
 *     const filtro = getBusinessFilter(user)
 *
 *     const datos = await prisma.sale.findMany({
 *       where: filtro ? { businessId: { in: filtro } } : undefined,
 *     })
 *   }
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

// Roles que ven TODOS los negocios sin filtro
const ROLES_GLOBALES = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING", "INVENTORY"]

/**
 * Obtiene la sesión del usuario actual.
 * Si no hay sesión activa, redirige al login automáticamente.
 *
 * Úsalo al inicio de cualquier Server Component protegido:
 *   const user = await requireSession()
 */
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  return session.user
}

/**
 * Devuelve el filtro de negocios para las consultas de Prisma.
 *
 * - Retorna null si el usuario puede ver TODOS los negocios (dueños, Rodrigo, etc.)
 * - Retorna un array con el businessId si el usuario solo ve su negocio
 * - Retorna array vacío si el usuario no tiene negocio asignado (error de configuración)
 *
 * Ejemplo de uso con Prisma:
 *   const filtro = getBusinessFilter(user)
 *   const ventas = await prisma.sale.findMany({
 *     where: filtro ? { businessId: { in: filtro } } : undefined,
 *   })
 */
export function getBusinessFilter(
  user: { role: string; primaryBusinessId?: string | null }
): string[] | null {
  if (ROLES_GLOBALES.includes(user.role)) return null
  if (user.primaryBusinessId) return [user.primaryBusinessId]
  return []
}

/**
 * Verifica si el usuario tiene acceso global (ve todos los negocios).
 */
export function isGlobal(user: { role: string }): boolean {
  return ROLES_GLOBALES.includes(user.role)
}

/**
 * Devuelve true si el usuario es gerente o superior.
 * Útil para mostrar/ocultar controles de administración en la UI.
 */
export function isManager(user: { role: string }): boolean {
  return [
    "MASTER_ADMIN", "OWNER", "SUPERIOR",
    "MANAGER_OPS", "MANAGER_RESTAURANT", "MANAGER_HOTEL", "MANAGER_RANCH", "MANAGER",
  ].includes(user.role)
}
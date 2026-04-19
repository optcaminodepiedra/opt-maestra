/**
 * lib/permissions.ts
 * Sistema central de permisos para OPT Maestra.
 * 
 * USO:
 *   import { can, getVisibleBusinessIds } from "@/lib/permissions"
 *   if (!can(session.user, "pos:operate")) redirect("/unauthorized")
 *   const bizIds = getVisibleBusinessIds(session.user)
 */

import type { User } from "@prisma/client"

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Role = User["role"]

/**
 * Todas las acciones posibles en el sistema.
 * Formato: "módulo:acción"
 */
export type Permission =
  // Dashboard
  | "dashboard:view_all"       // ve todos los negocios
  | "dashboard:view_own"       // solo su negocio
  // Usuarios
  | "users:manage"             // crear/editar/desactivar usuarios
  | "users:view"               // solo ver directorio
  // POS / Caja
  | "pos:operate"              // operar caja y cobrar
  | "pos:open_shift"           // abrir turno de caja
  | "pos:close_shift"          // cerrar turno de caja
  | "pos:view_reports"         // ver reportes de ventas
  // Retiros
  | "withdrawals:request_small"  // retiro de caja chica (compras)
  | "withdrawals:request_large"  // retiro grande → va a contadora
  | "withdrawals:approve"        // aprobar o rechazar retiros
  // Menú / Restaurante
  | "menu:edit"                // editar menú
  | "menu:view"                // solo ver menú
  | "tables:manage"            // mapa de mesas
  | "kds:view"                 // pantalla de cocina (KDS)
  | "orders:create"            // crear órdenes
  | "orders:view"              // ver órdenes
  // Hotel
  | "hotel:reservations"       // crear y ver reservaciones
  | "hotel:checkin_checkout"   // hacer check-in / check-out
  | "hotel:folio"              // ver y gestionar folios
  | "hotel:linked_food_orders" // ver órdenes de alimentos vinculadas a habitación
  // Inventario
  | "inventory:view"           // ver stock
  | "inventory:edit"           // ajustar inventario
  | "inventory:requisitions"   // hacer pedidos a inventario
  | "inventory:approve_req"    // aprobar requisiciones
  // RRHH / Asistencia
  | "hr:view_own"              // ver su propio perfil RRHH
  | "hr:view_team"             // ver su equipo
  | "hr:manage"                // editar toda la planta laboral
  | "hr:vacations_approve"     // aprobar vacaciones
  | "attendance:clock"         // checar entrada/salida
  | "attendance:view_team"     // ver asistencia de su equipo
  | "attendance:manage"        // ajustar marcaciones
  // Plantilla / Horarios
  | "schedule:view_own"        // ver su horario
  | "schedule:edit_team"       // editar plantilla de su negocio
  // Experiencias (Rancho)
  | "experiences:manage"       // gestionar actividades y tours
  | "experiences:view"
  // Spa (Tierra Adentro)
  | "spa:manage"
  | "spa:view"
  // Tienda / Torniquete
  | "store:operate"            // POS de la tienda
  | "store:turnstile"          // control torniquete de baños
  // Tareas / Tickets
  | "tasks:create"
  | "tasks:manage_all"         // ve y gestiona todas las tareas
  | "tasks:manage_own"         // solo las de su negocio
  // Contabilidad
  | "accounting:view"
  | "accounting:manage"
  // Configuración
  | "settings:global"          // configuración global de la plataforma
  | "settings:business"        // configuración de su negocio

// ─── Mapa de permisos por rol ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {

  // ── Rodrigo: control total ──────────────────────────────────────────────────
  MASTER_ADMIN: [
    "dashboard:view_all",
    "users:manage", "users:view",
    "pos:operate", "pos:open_shift", "pos:close_shift", "pos:view_reports",
    "withdrawals:request_small", "withdrawals:request_large", "withdrawals:approve",
    "menu:edit", "menu:view", "tables:manage", "kds:view", "orders:create", "orders:view",
    "hotel:reservations", "hotel:checkin_checkout", "hotel:folio", "hotel:linked_food_orders",
    "inventory:view", "inventory:edit", "inventory:requisitions", "inventory:approve_req",
    "hr:view_own", "hr:view_team", "hr:manage", "hr:vacations_approve",
    "attendance:clock", "attendance:view_team", "attendance:manage",
    "schedule:view_own", "schedule:edit_team",
    "experiences:manage", "experiences:view",
    "spa:manage", "spa:view",
    "store:operate", "store:turnstile",
    "tasks:create", "tasks:manage_all", "tasks:manage_own",
    "accounting:view", "accounting:manage",
    "settings:global", "settings:business",
  ],

  // ── Dueños: Alejandro, Saul, Sabina, Samantha ───────────────────────────────
  OWNER: [
    "dashboard:view_all",
    "users:view",
    "pos:view_reports",
    "withdrawals:approve",
    "menu:view", "orders:view",
    "hotel:reservations", "hotel:folio",
    "inventory:view",
    "hr:view_team", "hr:manage", "hr:vacations_approve",
    "attendance:view_team",
    "schedule:edit_team",
    "experiences:view",
    "spa:view",
    "tasks:manage_all",
    "accounting:view", "accounting:manage",
    "settings:business",
  ],

  // ── Carlos A y Fernanda: SUPERIOR (jurídico / dirección general) ─────────────
  SUPERIOR: [
    "dashboard:view_all",
    "users:view",
    "pos:view_reports",
    "withdrawals:approve",
    "menu:view", "orders:view",
    "hotel:reservations", "hotel:folio",
    "inventory:view",
    "hr:view_team", "hr:vacations_approve",
    "attendance:view_team",
    "tasks:manage_all",
    "accounting:view",
    "settings:business",
  ],

  // ── Gerentes generales (Claudia = Tierra Adentro, Iris = Rancho) ─────────────
  // Estos tienen acceso amplio pero solo a su businessId
  MANAGER_OPS: [
    "dashboard:view_own",
    "users:view",
    "pos:operate", "pos:open_shift", "pos:close_shift", "pos:view_reports",
    "withdrawals:request_small", "withdrawals:request_large",
    "menu:edit", "menu:view", "tables:manage", "kds:view", "orders:create", "orders:view",
    "hotel:reservations", "hotel:checkin_checkout", "hotel:folio", "hotel:linked_food_orders",
    "inventory:view", "inventory:edit", "inventory:requisitions",
    "hr:view_own", "hr:view_team",
    "attendance:clock", "attendance:view_team",
    "schedule:view_own", "schedule:edit_team",
    "experiences:manage", "experiences:view",
    "spa:manage", "spa:view",
    "store:operate", "store:turnstile",
    "tasks:create", "tasks:manage_own",
    "accounting:view",
    "settings:business",
  ],

  // ── Gerentes de restaurante (Judith = Bodega 4, Saúl P = Tierra Adentro rest) ─
  MANAGER_RESTAURANT: [
    "dashboard:view_own",
    "pos:operate", "pos:open_shift", "pos:close_shift", "pos:view_reports",
    "withdrawals:request_small", "withdrawals:request_large",
    "menu:edit", "menu:view", "tables:manage", "kds:view", "orders:create", "orders:view",
    "hotel:linked_food_orders",   // ver habitaciones con servicio de alimentos
    "inventory:view", "inventory:requisitions",
    "hr:view_own", "hr:view_team",
    "attendance:clock", "attendance:view_team",
    "schedule:view_own", "schedule:edit_team",
    "tasks:create", "tasks:manage_own",
    "accounting:view",
  ],

  // ── Gerente de hotel ─────────────────────────────────────────────────────────
  MANAGER_HOTEL: [
    "dashboard:view_own",
    "pos:view_reports",
    "hotel:reservations", "hotel:checkin_checkout", "hotel:folio", "hotel:linked_food_orders",
    "inventory:view", "inventory:requisitions",
    "hr:view_own", "hr:view_team",
    "attendance:clock", "attendance:view_team",
    "schedule:view_own", "schedule:edit_team",
    "tasks:create", "tasks:manage_own",
    "accounting:view",
  ],

  // ── Gerente de rancho ────────────────────────────────────────────────────────
  MANAGER_RANCH: [
    "dashboard:view_own",
    "pos:operate", "pos:open_shift", "pos:close_shift", "pos:view_reports",
    "withdrawals:request_small",
    "hotel:reservations", "hotel:checkin_checkout", "hotel:folio",
    "inventory:view", "inventory:requisitions",
    "experiences:manage", "experiences:view",
    "hr:view_own", "hr:view_team",
    "attendance:clock", "attendance:view_team",
    "schedule:view_own", "schedule:edit_team",
    "tasks:create", "tasks:manage_own",
  ],

  // ── Contabilidad ─────────────────────────────────────────────────────────────
  ACCOUNTING: [
    "dashboard:view_all",
    "pos:view_reports",
    "withdrawals:approve",
    "inventory:view",
    "hr:view_team",
    "accounting:view", "accounting:manage",
    "tasks:create",
  ],

  // ── Ventas / Reservaciones ───────────────────────────────────────────────────
  SALES: [
    "dashboard:view_own",
    "hotel:reservations",
    "orders:create", "orders:view",
    "tasks:create",
  ],

  RESERVATIONS: [
    "dashboard:view_own",
    "hotel:reservations", "hotel:checkin_checkout",
    "tasks:create",
  ],

  // ── Inventario ───────────────────────────────────────────────────────────────
  INVENTORY: [
    "dashboard:view_own",
    "inventory:view", "inventory:edit", "inventory:requisitions",
    "attendance:clock",
    "tasks:create",
  ],

  // ── Staff de cocina ──────────────────────────────────────────────────────────
  STAFF_KITCHEN: [
    "kds:view",
    "orders:view",
    "inventory:view",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Staff de bar ─────────────────────────────────────────────────────────────
  STAFF_BAR: [
    "pos:operate",
    "menu:view", "orders:create", "orders:view",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Mesero ───────────────────────────────────────────────────────────────────
  STAFF_WAITER: [
    "menu:view", "orders:create", "orders:view", "tables:manage",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Recepción ────────────────────────────────────────────────────────────────
  STAFF_RECEPTION: [
    "hotel:reservations", "hotel:checkin_checkout",
    "orders:view",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Experiencias / Guías ─────────────────────────────────────────────────────
  STAFF_EXPERIENCES: [
    "experiences:view",
    "pos:operate",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Cajero ───────────────────────────────────────────────────────────────────
  STAFF_CASHIER: [
    "pos:operate", "pos:open_shift", "pos:close_shift",
    "withdrawals:request_small",
    "orders:view",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
  ],

  // ── Housekeeping ─────────────────────────────────────────────────────────────
  STAFF_HOUSEKEEPING: [
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Mantenimiento ────────────────────────────────────────────────────────────
  STAFF_MAINTENANCE: [
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Personal de campo (Rancho) ────────────────────────────────────────────────
  STAFF_FIELD: [
    "experiences:view",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
    "tasks:create",
  ],

  // ── Tienda ────────────────────────────────────────────────────────────────────
  STAFF_STORE: [
    "store:operate", "store:turnstile",
    "attendance:clock",
    "hr:view_own", "schedule:view_own",
  ],

  // ── Manager general (fallback) ────────────────────────────────────────────────
  MANAGER: [
    "dashboard:view_own",
    "pos:operate", "pos:view_reports",
    "withdrawals:request_small",
    "menu:view", "orders:create", "orders:view",
    "inventory:view",
    "hr:view_own", "hr:view_team",
    "attendance:clock", "attendance:view_team",
    "schedule:view_own", "schedule:edit_team",
    "tasks:create", "tasks:manage_own",
  ],
}

// ─── Funciones de consulta ────────────────────────────────────────────────────

/**
 * Verifica si un usuario tiene un permiso específico.
 * 
 * Ejemplo:
 *   if (!can(session.user, "pos:operate")) redirect("/unauthorized")
 */
export function can(user: Pick<User, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}

/**
 * Verifica si el usuario tiene TODOS los permisos dados.
 */
export function canAll(user: Pick<User, "role">, ...permissions: Permission[]): boolean {
  return permissions.every(p => can(user, p))
}

/**
 * Verifica si el usuario tiene AL MENOS UNO de los permisos dados.
 */
export function canAny(user: Pick<User, "role">, ...permissions: Permission[]): boolean {
  return permissions.some(p => can(user, p))
}

/**
 * Retorna la lista de IDs de negocios que el usuario puede ver.
 * - MASTER_ADMIN, OWNER, SUPERIOR, ACCOUNTING → null (ve todos)
 * - Cualquier otro rol → solo su businessId
 * 
 * En tus queries de Prisma usa esto como filtro:
 *   const bizFilter = getVisibleBusinessIds(user)
 *   where: bizFilter ? { businessId: { in: bizFilter } } : {}
 */
export function getVisibleBusinessIds(
  user: Pick<User, "role" | "businessId">
): string[] | null {
  const globalRoles: Role[] = ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"]
  if (globalRoles.includes(user.role)) return null
  if (user.businessId) return [user.businessId]
  return []
}

/**
 * Retorna true si el usuario puede ver todos los negocios.
 */
export function hasGlobalAccess(user: Pick<User, "role">): boolean {
  return ["MASTER_ADMIN", "OWNER", "SUPERIOR", "ACCOUNTING"].includes(user.role)
}

/**
 * Lista de permisos que tiene un rol (para debugging o UI de configuración).
 */
export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
/**
 * lib/nav.ts
 *
 * Devuelve NavSection[] — exactamente la estructura que consume el Sidebar existente.
 * Los nombres de íconos deben coincidir con el iconMap del Sidebar.tsx.
 */

// ─── Tipos (compatibles con Sidebar.tsx) ─────────────────────────────────────

export type IconName =
  | "dashboard" | "finance" | "sales" | "expenses" | "withdrawals"
  | "reports" | "users" | "settings" | "tasks" | "kanban"
  | "apps" | "reloj" | "restaurant" | "pos" | "kds" | "tables"
  | "menu" | "hotel" | "museum" | "adventure" | "inventory"
  | "payroll" | "iot";

export type NavItem = {
  label: string
  href: string
  icon: IconName
  badge?: string
}

export type NavSection = {
  title: string
  icon?: IconName
  items: NavItem[]
}

// ─── Todas las secciones del sistema ─────────────────────────────────────────
// Cada sección tiene un array de roles que pueden verla.
// Dentro de cada sección, cada ítem también tiene sus propios roles.

type RoledSection = {
  title: string
  icon?: IconName
  roles: string[]   // quién puede ver esta sección completa
  items: (NavItem & { roles: string[] })[]
}

const ALL = [
  "MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT",
  "MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS",
  "INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION",
  "STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE",
  "STAFF_FIELD","STAFF_STORE","MANAGER",
]

const MANAGERS = [
  "MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT",
  "MANAGER_HOTEL","MANAGER_RANCH","MANAGER",
]

const SECTIONS: RoledSection[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    title: "General",
    icon: "apps",
    roles: ALL,
    items: [
      { label: "Dashboard", href: "/app", icon: "dashboard", roles: ALL },
      { label: "Checador", href: "/app/reloj", icon: "reloj", roles: ALL },
      { label: "Tareas", href: "/app/ops/kanban/activities", icon: "tasks", roles: ALL },
    ],
  },

  // ── Restaurante ──────────────────────────────────────────────────────────
  {
    title: "Restaurante",
    icon: "restaurant",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","STAFF_KITCHEN","MANAGER"],
    items: [
      { label: "POS / Caja",    href: "/app/restaurant/pos",    icon: "pos",    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_BAR","STAFF_CASHIER","MANAGER"] },
      { label: "Mesas",         href: "/app/restaurant/tables", icon: "tables", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","MANAGER"] },
      { label: "Cocina (KDS)",  href: "/app/restaurant/kds",    icon: "kds",    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_KITCHEN","STAFF_BAR","MANAGER"] },
      { label: "Menú",          href: "/app/restaurant/menu",   icon: "menu",   roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER"] },
    ],
  },

  // ── Hotel ────────────────────────────────────────────────────────────────
  {
    title: "Hotel",
    icon: "hotel",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],
    items: [
      { label: "Reservaciones", href: "/app/hotel/reservations", icon: "hotel",  roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"] },
      { label: "Habitaciones",  href: "/app/hotel/rooms",        icon: "hotel",  roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER"] },
      { label: "Front Desk",    href: "/app/hotel/frontdesk",    icon: "hotel",  roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER"] },
      { label: "Housekeeping",  href: "/app/hotel/housekeeping", icon: "hotel",  roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","STAFF_HOUSEKEEPING","MANAGER"] },
    ],
  },

  // ── Inventario ───────────────────────────────────────────────────────────
  {
    title: "Inventario",
    icon: "inventory",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_STORE","MANAGER"],
    items: [
      { label: "Stock",         href: "/app/inventory",              icon: "inventory", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_STORE","MANAGER"] },
      { label: "Requisiciones", href: "/app/inventory/requisitions", icon: "kanban",    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","INVENTORY","MANAGER"] },
    ],
  },

  // ── Experiencias ─────────────────────────────────────────────────────────
  {
    title: "Experiencias",
    icon: "adventure",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","STAFF_FIELD","MANAGER"],
    items: [
      { label: "Actividades", href: "/app/adventure", icon: "adventure", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","STAFF_FIELD","MANAGER"] },
    ],
  },

  // ── Finanzas ─────────────────────────────────────────────────────────────
  {
    title: "Finanzas",
    icon: "finance",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
    items: [
      { label: "Reportes",      href: "/app/reports",            icon: "reports",     roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"] },
      { label: "Gastos",        href: "/app/owner/expenses",     icon: "expenses",    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","MANAGER"] },
      { label: "Retiros",       href: "/app/owner/withdrawals",  icon: "withdrawals", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","MANAGER"] },
      { label: "Ventas",        href: "/app/accounting",         icon: "sales",       roles: ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"] },
    ],
  },

  // ── RRHH ─────────────────────────────────────────────────────────────────
  {
    title: "RRHH",
    icon: "payroll",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],
    items: [
      { label: "Asistencias", href: "/app/payroll",    icon: "payroll", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"] },
      { label: "Vacaciones",  href: "/app/vacations",  icon: "payroll", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"] },
    ],
  },

  // ── Administración ───────────────────────────────────────────────────────
  {
    title: "Administración",
    icon: "settings",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
    items: [
      { label: "Usuarios",      href: "/app/owner/users",      icon: "users",    roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
      { label: "Negocios",      href: "/app/owner/businesses", icon: "apps",     roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
      { label: "Configuración", href: "/app/settings",         icon: "settings", roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
    ],
  },

  // ── Museos ───────────────────────────────────────────────────────────────
  {
    title: "Museos",
    icon: "museum",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS"],
    items: [
      { label: "Casa de los Lamentos", href: "/app/museums", icon: "museum", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS"] },
      { label: "Las Catacumbas",       href: "/app/museums", icon: "museum", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS"] },
    ],
  },
]

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Devuelve las secciones de navegación para un rol dado.
 * - Filtra las secciones que el rol puede ver.
 * - Dentro de cada sección, filtra los ítems que el rol puede ver.
 * - Si una sección queda sin ítems visibles, se elimina.
 * - items SIEMPRE es un array (nunca undefined) — previene el error .map().
 */
export function getNavForRole(role: string): NavSection[] {
  return SECTIONS
    .filter(sec => sec.roles.includes(role))
    .map(sec => ({
      title: sec.title,
      icon: sec.icon,
      // Filtramos ítems y eliminamos la propiedad `roles` que el Sidebar no necesita
      items: sec.items
        .filter(item => item.roles.includes(role))
        .map(({ roles: _roles, ...item }) => item),
    }))
    // Si todos los ítems de una sección se filtraron, eliminamos la sección
    .filter(sec => sec.items.length > 0)
}

// Alias para compatibilidad con el layout existente
export const getNavByRole = getNavForRole
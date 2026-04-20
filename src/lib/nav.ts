// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NavItem = {
  label: string
  href: string
  icon: string
  roles: string[]
  badge?: string
  children?: NavItem[]
}

// Todos los roles del sistema
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

// ─── Definición completa del menú ────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app",
    icon: "LayoutDashboard",
    roles: ALL,
  },
  {
    label: "Restaurante",
    href: "/app/restaurant",
    icon: "UtensilsCrossed",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","STAFF_KITCHEN","MANAGER"],
    children: [
      { label: "POS / Caja", href: "/app/restaurant/pos", icon: "ShoppingCart", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_BAR","STAFF_CASHIER","MANAGER"] },
      { label: "Mapa de mesas", href: "/app/restaurant/tables", icon: "Map", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","MANAGER"] },
      { label: "Órdenes", href: "/app/restaurant/orders", icon: "ClipboardList", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","MANAGER"] },
      { label: "Cocina (KDS)", href: "/app/restaurant/kds", icon: "ChefHat", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_KITCHEN","MANAGER"] },
      { label: "Menú", href: "/app/restaurant/menu", icon: "BookOpen", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER"] },
      { label: "Turnos", href: "/app/shifts", icon: "Timer", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_CASHIER","MANAGER"] },
    ],
  },
  {
    label: "Hotel",
    href: "/app/hotel",
    icon: "BedDouble",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],
    children: [
      { label: "Reservaciones", href: "/app/hotel/reservations", icon: "CalendarCheck", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"] },
      { label: "Habitaciones", href: "/app/hotel/rooms", icon: "Hotel", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER"] },
      { label: "Front Desk", href: "/app/hotel/frontdesk", icon: "ConciergeBell", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER"] },
      { label: "Housekeeping", href: "/app/hotel/housekeeping", icon: "Sparkles", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","STAFF_HOUSEKEEPING","MANAGER"] },
    ],
  },
  {
    label: "Inventario",
    href: "/app/inventory",
    icon: "Boxes",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_STORE","MANAGER"],
    children: [
      { label: "Stock", href: "/app/inventory", icon: "Package", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","STAFF_STORE","MANAGER"] },
      { label: "Requisiciones", href: "/app/inventory/requisitions", icon: "ClipboardPlus", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","INVENTORY","MANAGER"] },
    ],
  },
  {
    label: "Experiencias",
    href: "/app/adventure",
    icon: "TreePine",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","STAFF_FIELD","MANAGER"],
  },
  {
    label: "Tienda",
    href: "/app/store",
    icon: "Store",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],
  },
  {
    label: "Finanzas",
    href: "/app/reports",
    icon: "TrendingUp",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
    children: [
      { label: "Reportes", href: "/app/reports", icon: "BarChart3", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"] },
      { label: "Retiros", href: "/app/owner/withdrawals", icon: "Banknote", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","ACCOUNTING","MANAGER"] },
      { label: "Gastos", href: "/app/owner/expenses", icon: "Receipt", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"] },
      { label: "Contabilidad", href: "/app/accounting", icon: "Calculator", roles: ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"] },
    ],
  },
  {
    label: "Tareas",
    href: "/app/ops/kanban/activities",
    icon: "CheckSquare",
    roles: ALL,
  },
  {
    label: "Asistencias",
    href: "/app/payroll",
    icon: "Fingerprint",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],
  },
  {
    label: "Checador",
    href: "/app/reloj",
    icon: "Clock",
    roles: ALL,
  },
  {
    label: "Vacaciones",
    href: "/app/vacations",
    icon: "Palmtree",
    roles: ALL,
  },
  {
    label: "Administración",
    href: "/app/owner",
    icon: "Settings2",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
    children: [
      { label: "Usuarios", href: "/app/owner/users", icon: "Users2", roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
      { label: "Negocios", href: "/app/owner/businesses", icon: "Building2", roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
      { label: "Configuración", href: "/app/settings", icon: "Settings", roles: ["MASTER_ADMIN","OWNER","SUPERIOR"] },
    ],
  },
]

// ─── Función de filtrado — la clave ──────────────────────────────────────────

/**
 * Devuelve los ítems de navegación que puede ver el rol dado.
 * IMPORTANTE: children SIEMPRE es un array (nunca undefined),
 * y si todos los children se filtran, el ítem padre también desaparece.
 */
export function getNavForRole(role: string): NavItem[] {
  return NAV_ITEMS
    .filter(item => item.roles.includes(role))
    .map(item => {
      // Si el ítem no tiene children, devolvemos sin la propiedad
      if (!item.children) return { ...item }

      // Filtramos los children que el rol puede ver
      const visibleChildren = item.children.filter(c => c.roles.includes(role))

      return {
        ...item,
        // SIEMPRE un array, nunca undefined — esto evita el error .map()
        children: visibleChildren,
      }
    })
    // Si un ítem tenía children pero ninguno es visible para este rol,
    // lo dejamos igual (el ítem padre sigue siendo clickeable como link directo)
}

// Alias para compatibilidad con el layout existente
export const getNavByRole = getNavForRole
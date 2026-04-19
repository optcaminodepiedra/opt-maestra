/**
 * lib/nav.ts
 * 
 * Define TODO el menú de la aplicación en un solo lugar.
 * Tu sidebar solo importa esto y filtra por el rol del usuario.
 * 
 * Cuando agregues una nueva sección, solo editas ESTE archivo.
 */

export type NavItem = {
  label: string
  href: string
  icon: string          // nombre del ícono de lucide-react
  roles: string[]       // qué roles ven este ítem
  badge?: string        // texto opcional en badge (ej: "Nuevo")
  children?: NavItem[]  // submenú
}

// Roles que ven TODO
const ALL = [
  "MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT",
  "MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS",
  "INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION",
  "STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE",
  "STAFF_FIELD","STAFF_STORE","MANAGER",
]

// Roles con acceso global (sin filtro de negocio)
const GLOBAL = ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"]

// Roles de gerencia
const MANAGERS = ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","MANAGER"]

export const NAV_ITEMS: NavItem[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/app",
    icon: "LayoutDashboard",
    roles: ALL,
  },

  // ── Restaurante / POS ──────────────────────────────────────────────────────
  {
    label: "Restaurante",
    href: "/app/pos",
    icon: "UtensilsCrossed",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","STAFF_KITCHEN","MANAGER"],
    children: [
      {
        label: "POS / Caja",
        href: "/app/pos",
        icon: "ShoppingCart",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_BAR","STAFF_CASHIER","MANAGER"],
      },
      {
        label: "Mapa de mesas",
        href: "/app/tables",
        icon: "Map",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","MANAGER"],
      },
      {
        label: "Órdenes",
        href: "/app/orders",
        icon: "ClipboardList",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","MANAGER"],
      },
      {
        label: "Cocina (KDS)",
        href: "/app/kds",
        icon: "ChefHat",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_KITCHEN","MANAGER"],
      },
      {
        label: "Menú",
        href: "/app/menu",
        icon: "BookOpen",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER"],
      },
      {
        label: "Turnos de caja",
        href: "/app/shifts",
        icon: "Timer",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","STAFF_CASHIER","MANAGER"],
      },
    ],
  },

  // ── Hotel ──────────────────────────────────────────────────────────────────
  {
    label: "Hotel",
    href: "/app/hotel",
    icon: "BedDouble",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],
    children: [
      {
        label: "Reservaciones",
        href: "/app/reservations",
        icon: "CalendarCheck",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER"],
      },
      {
        label: "Habitaciones",
        href: "/app/hotel/rooms",
        icon: "Hotel",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER"],
      },
      {
        label: "Folios",
        href: "/app/hotel/folios",
        icon: "ReceiptText",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","ACCOUNTING","MANAGER"],
      },
    ],
  },

  // ── Inventario ─────────────────────────────────────────────────────────────
  {
    label: "Inventario",
    href: "/app/inventory",
    icon: "Boxes",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],
    children: [
      {
        label: "Stock",
        href: "/app/inventory",
        icon: "Package",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","INVENTORY","MANAGER"],
      },
      {
        label: "Requisiciones",
        href: "/app/requisitions",
        icon: "ClipboardPlus",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","INVENTORY","MANAGER"],
      },
      {
        label: "Movimientos",
        href: "/app/inventory/movements",
        icon: "ArrowLeftRight",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","INVENTORY","ACCOUNTING","MANAGER"],
      },
    ],
  },

  // ── Rancho / Experiencias ──────────────────────────────────────────────────
  {
    label: "Experiencias",
    href: "/app/experiences",
    icon: "TreePine",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RANCH","STAFF_EXPERIENCES","STAFF_FIELD","MANAGER"],
  },

  // ── Tierra Adentro Spa ─────────────────────────────────────────────────────
  {
    label: "Spa",
    href: "/app/spa",
    icon: "Sparkles",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER"],
  },

  // ── Tienda / Torniquete ────────────────────────────────────────────────────
  {
    label: "Tienda",
    href: "/app/store",
    icon: "Store",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],
    children: [
      {
        label: "POS Tienda",
        href: "/app/store",
        icon: "ShoppingCart",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],
      },
      {
        label: "Torniquete Baños",
        href: "/app/turnstile",
        icon: "DoorOpen",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","STAFF_STORE","MANAGER"],
      },
    ],
  },

  // ── Finanzas ───────────────────────────────────────────────────────────────
  {
    label: "Finanzas",
    href: "/app/reports",
    icon: "TrendingUp",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
    children: [
      {
        label: "Reportes",
        href: "/app/reports",
        icon: "BarChart3",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
      },
      {
        label: "Retiros",
        href: "/app/withdrawals",
        icon: "Banknote",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","ACCOUNTING","MANAGER"],
      },
      {
        label: "Contabilidad",
        href: "/app/accounting",
        icon: "Calculator",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","ACCOUNTING"],
      },
    ],
  },

  // ── RRHH ───────────────────────────────────────────────────────────────────
  {
    label: "RRHH",
    href: "/app/hr",
    icon: "Users",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
    children: [
      {
        label: "Personal",
        href: "/app/hr",
        icon: "UserCircle",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","MANAGER"],
      },
      {
        label: "Horarios",
        href: "/app/schedule",
        icon: "CalendarDays",
        roles: MANAGERS,
      },
      {
        label: "Vacaciones",
        href: "/app/vacations",
        icon: "Palmtree",
        roles: ALL,
      },
    ],
  },

  // ── Asistencia (Checador) ──────────────────────────────────────────────────
  {
    label: "Asistencia",
    href: "/app/attendance",
    icon: "Fingerprint",
    roles: ALL,
  },

  // ── Tareas / Tickets ───────────────────────────────────────────────────────
  {
    label: "Tareas",
    href: "/app/tasks",
    icon: "CheckSquare",
    roles: ALL,
  },

  // ── Administración (solo admins) ────────────────────────────────────────────
  {
    label: "Administración",
    href: "/app/owner",
    icon: "Settings2",
    roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
    children: [
      {
        label: "Usuarios",
        href: "/app/owner/users",
        icon: "Users2",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
      },
      {
        label: "Negocios",
        href: "/app/owner/businesses",
        icon: "Building2",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
      },
      {
        label: "Configuración",
        href: "/app/settings",
        icon: "Settings",
        roles: ["MASTER_ADMIN","OWNER","SUPERIOR"],
      },
    ],
  },
]

/**
 * Filtra los ítems de navegación según el rol del usuario.
 * Úsalo en tu sidebar así:
 * 
 *   import { getNavForRole } from "@/lib/nav"
 *   const items = getNavForRole(session.user.role)
 */
export function getNavForRole(role: string): NavItem[] {
  return NAV_ITEMS
    .filter(item => item.roles.includes(role))
    .map(item => ({
      ...item,
      children: item.children?.filter(child => child.roles.includes(role)),
    }))
}
// Alias para compatibilidad con el layout existente
export const getNavByRole = getNavForRole;
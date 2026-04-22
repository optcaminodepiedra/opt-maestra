export type IconName =
  | "dashboard" | "finance" | "sales" | "expenses" | "withdrawals"
  | "reports" | "users" | "settings" | "tasks" | "kanban"
  | "apps" | "reloj" | "restaurant" | "pos" | "kds" | "tables"
  | "menu" | "hotel" | "museum" | "adventure" | "inventory"
  | "payroll" | "iot" | "database" | "history";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  badge?: string;
};

export type NavSection = {
  title: string;
  icon?: IconName;
  items: NavItem[];
};

type RoledSection = {
  title: string;
  icon?: IconName;
  roles: string[];
  items: (NavItem & { roles: string[] })[];
};

const ALL = [
  "MASTER_ADMIN","OWNER","SUPERIOR","MANAGER_OPS","MANAGER_RESTAURANT",
  "MANAGER_HOTEL","MANAGER_RANCH","ACCOUNTING","SALES","RESERVATIONS",
  "INVENTORY","STAFF_KITCHEN","STAFF_BAR","STAFF_WAITER","STAFF_RECEPTION",
  "STAFF_EXPERIENCES","STAFF_CASHIER","STAFF_HOUSEKEEPING","STAFF_MAINTENANCE",
  "STAFF_FIELD","STAFF_STORE","MANAGER",
];

const DIRECTION = ["MASTER_ADMIN","OWNER","SUPERIOR"];

const SECTIONS: RoledSection[] = [
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

  // ───────────────── OPS (Claudia) ─────────────────
  {
    title: "Mi operación",
    icon: "dashboard",
    roles: ["MANAGER_OPS", ...DIRECTION],
    items: [
      { label: "Dashboard",            href: "/app/manager/ops",              icon: "dashboard", roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Finanzas",             href: "/app/manager/ops/finances",     icon: "finance",   roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Reportes",             href: "/app/manager/ops/reports",      icon: "reports",   roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Inventario",           href: "/app/manager/ops/inventory",    icon: "inventory", roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Requisiciones",        href: "/app/manager/ops/requisitions", icon: "kanban",    roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Equipo (asistencias)", href: "/app/manager/ops/payroll",      icon: "payroll",   roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Plantilla / Horarios", href: "/app/manager/ops/schedule",     icon: "payroll",   roles: ["MANAGER_OPS", ...DIRECTION] },
    ],
  },

  // ───────────────── RESTAURANT (Judith) ─────────────────
  {
    title: "Mi operación",
    icon: "dashboard",
    roles: ["MANAGER_RESTAURANT"],
    items: [
      { label: "Dashboard",            href: "/app/manager/restaurant",              icon: "dashboard", roles: ["MANAGER_RESTAURANT"] },
      { label: "Finanzas",             href: "/app/manager/restaurant/finances",     icon: "finance",   roles: ["MANAGER_RESTAURANT"] },
      { label: "Reportes",             href: "/app/manager/restaurant/reports",      icon: "reports",   roles: ["MANAGER_RESTAURANT"] },
      { label: "Inventario",           href: "/app/manager/restaurant/inventory",    icon: "inventory", roles: ["MANAGER_RESTAURANT"] },
      { label: "Requisiciones",        href: "/app/manager/restaurant/requisitions", icon: "kanban",    roles: ["MANAGER_RESTAURANT"] },
      { label: "Equipo (asistencias)", href: "/app/manager/restaurant/payroll",      icon: "payroll",   roles: ["MANAGER_RESTAURANT"] },
      { label: "Plantilla / Horarios", href: "/app/manager/restaurant/schedule",     icon: "payroll",   roles: ["MANAGER_RESTAURANT"] },
    ],
  },

  // ───────────────── RANCH (Iris) ─────────────────
  {
    title: "Mi operación",
    icon: "dashboard",
    roles: ["MANAGER_RANCH"],
    items: [
      { label: "Dashboard",            href: "/app/manager/ranch",              icon: "dashboard", roles: ["MANAGER_RANCH"] },
      { label: "Finanzas",             href: "/app/manager/ranch/finances",     icon: "finance",   roles: ["MANAGER_RANCH"] },
      { label: "Reportes",             href: "/app/manager/ranch/reports",      icon: "reports",   roles: ["MANAGER_RANCH"] },
      { label: "Inventario",           href: "/app/manager/ranch/inventory",    icon: "inventory", roles: ["MANAGER_RANCH"] },
      { label: "Requisiciones",        href: "/app/manager/ranch/requisitions", icon: "kanban",    roles: ["MANAGER_RANCH"] },
      { label: "Equipo (asistencias)", href: "/app/manager/ranch/payroll",      icon: "payroll",   roles: ["MANAGER_RANCH"] },
      { label: "Plantilla / Horarios", href: "/app/manager/ranch/schedule",     icon: "payroll",   roles: ["MANAGER_RANCH"] },
      { label: "Experiencias",         href: "/app/adventure",                  icon: "adventure", roles: ["MANAGER_RANCH"] },
    ],
  },

  // ───────────────── Staff restaurante ─────────────────
  {
    title: "Restaurante",
    icon: "restaurant",
    roles: ["MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_WAITER","STAFF_BAR","STAFF_CASHIER","STAFF_KITCHEN","MANAGER", ...DIRECTION],
    items: [
      { label: "POS / Caja",   href: "/app/restaurant/pos",    icon: "pos",    roles: ["MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_BAR","STAFF_CASHIER","MANAGER", ...DIRECTION] },
      { label: "Mesas",        href: "/app/restaurant/tables", icon: "tables", roles: ["MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_WAITER","MANAGER", ...DIRECTION] },
      { label: "Cocina (KDS)", href: "/app/restaurant/kds",    icon: "kds",    roles: ["MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","STAFF_KITCHEN","STAFF_BAR","MANAGER", ...DIRECTION] },
      { label: "Menú",         href: "/app/restaurant/menu",   icon: "menu",   roles: ["MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_RANCH","MANAGER", ...DIRECTION] },
    ],
  },

  // ───────────────── Hotel ─────────────────
  {
    title: "Hotel",
    icon: "hotel",
    roles: ["MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER", ...DIRECTION],
    items: [
      { label: "Reservaciones", href: "/app/hotel/reservations", icon: "hotel", roles: ["MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","RESERVATIONS","SALES","STAFF_RECEPTION","MANAGER", ...DIRECTION] },
      { label: "Habitaciones",  href: "/app/hotel/rooms",        icon: "hotel", roles: ["MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER", ...DIRECTION] },
      { label: "Front Desk",    href: "/app/hotel/frontdesk",    icon: "hotel", roles: ["MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_RECEPTION","MANAGER", ...DIRECTION] },
      { label: "Housekeeping",  href: "/app/hotel/housekeeping", icon: "hotel", roles: ["MANAGER_OPS","MANAGER_HOTEL","MANAGER_RANCH","STAFF_HOUSEKEEPING","MANAGER", ...DIRECTION] },
    ],
  },

  // ───────────────── Claudia - Servicios extra ─────────────────
  {
    title: "Servicios extra",
    icon: "apps",
    roles: ["MANAGER_OPS", ...DIRECTION],
    items: [
      { label: "Spa",            href: "/app/spa",                  icon: "adventure", roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Tienda",         href: "/app/store",                icon: "inventory", roles: ["MANAGER_OPS", ...DIRECTION, "STAFF_STORE"] },
      { label: "Baños públicos", href: "/app/facilities/bathrooms", icon: "iot",       roles: ["MANAGER_OPS", ...DIRECTION] },
    ],
  },

  // ───────────────── Staff experiencias ─────────────────
  {
    title: "Experiencias",
    icon: "adventure",
    roles: ["STAFF_EXPERIENCES","STAFF_FIELD"],
    items: [
      { label: "Actividades", href: "/app/adventure", icon: "adventure", roles: ["STAFF_EXPERIENCES","STAFF_FIELD"] },
    ],
  },

  // ───────────────── Almacén global (Goyo) ─────────────────
  {
    title: "Almacén general",
    icon: "inventory",
    roles: ["INVENTORY", "ACCOUNTING", ...DIRECTION],
    items: [
      { label: "Stock global",            href: "/app/inventory",              icon: "inventory", roles: ["INVENTORY","ACCOUNTING", ...DIRECTION] },
      { label: "Todas las requisiciones", href: "/app/inventory/requisitions", icon: "kanban",    roles: ["INVENTORY","ACCOUNTING", ...DIRECTION] },
    ],
  },

  // ───────────────── Finanzas globales ─────────────────
  {
    title: "Finanzas globales",
    icon: "finance",
    roles: ["ACCOUNTING", ...DIRECTION],
    items: [
      { label: "Reportes globales", href: "/app/reports",           icon: "reports",     roles: ["ACCOUNTING", ...DIRECTION] },
      { label: "Gastos globales",   href: "/app/owner/expenses",    icon: "expenses",    roles: [...DIRECTION] },
      { label: "Retiros globales",  href: "/app/owner/withdrawals", icon: "withdrawals", roles: [...DIRECTION] },
      { label: "Ventas (contable)", href: "/app/accounting",        icon: "sales",       roles: ["ACCOUNTING", ...DIRECTION] },
    ],
  },

  // ───────────────── RRHH ─────────────────
  {
    title: "RRHH",
    icon: "payroll",
    roles: ["ACCOUNTING", ...DIRECTION],
    items: [
      { label: "Asistencias (todos)", href: "/app/payroll",   icon: "payroll", roles: ["ACCOUNTING", ...DIRECTION] },
      { label: "Vacaciones",          href: "/app/vacations", icon: "payroll", roles: ["ACCOUNTING", ...DIRECTION, "MANAGER_OPS","MANAGER_RESTAURANT","MANAGER_HOTEL","MANAGER_RANCH","MANAGER"] },
    ],
  },

  // ───────────────── Admin - Importar data (NUEVO) ─────────────────
  {
    title: "Importar data",
    icon: "database",
    roles: DIRECTION,
    items: [
      { label: "Nuevo import", href: "/app/admin/import",         icon: "database", roles: DIRECTION },
      { label: "Historial",    href: "/app/admin/import/history", icon: "history",  roles: DIRECTION },
    ],
  },

  // ───────────────── Administración ─────────────────
  {
    title: "Administración",
    icon: "settings",
    roles: DIRECTION,
    items: [
      { label: "Usuarios",      href: "/app/owner/users",      icon: "users",    roles: DIRECTION },
      { label: "Negocios",      href: "/app/owner/businesses", icon: "apps",     roles: DIRECTION },
      { label: "Configuración", href: "/app/settings",         icon: "settings", roles: DIRECTION },
    ],
  },

  // ───────────────── Museos ─────────────────
  {
    title: "Museos",
    icon: "museum",
    roles: ["MANAGER_OPS", ...DIRECTION],
    items: [
      { label: "Casa de los Lamentos", href: "/app/museums", icon: "museum", roles: ["MANAGER_OPS", ...DIRECTION] },
      { label: "Las Catacumbas",       href: "/app/museums", icon: "museum", roles: ["MANAGER_OPS", ...DIRECTION] },
    ],
  },
];

export function getNavForRole(role: string): NavSection[] {
  return SECTIONS
    .filter((sec) => sec.roles.includes(role))
    .map((sec) => ({
      title: sec.title,
      icon: sec.icon,
      items: sec.items
        .filter((item) => item.roles.includes(role))
        .map(({ roles: _r, ...item }) => item),
    }))
    .filter((sec) => sec.items.length > 0);
}

export const getNavByRole = getNavForRole;

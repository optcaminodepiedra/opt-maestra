export type IconName =
  | "dashboard"
  | "finance"
  | "sales"
  | "expenses"
  | "withdrawals"
  | "reports"
  | "users"
  | "settings"
  | "tasks"
  | "kanban"
  | "restaurant"
  | "pos"
  | "kds"
  | "tables"
  | "menu"
  | "hotel"
  | "museum"
  | "adventure"
  | "inventory"
  | "payroll"
  | "iot"
  | "apps"
  | "reloj"; // <--- 1. Agregamos "reloj"

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

function sec(title: string, items: NavItem[], icon?: IconName): NavSection {
  return { title, items, icon };
}

export function getNavByRole(role: string): NavSection[] {
  const executive: NavSection = sec("Ejecutivo", [{ label: "Dashboard", href: "/app/owner", icon: "dashboard" }], "dashboard");
  const financeOwner: NavSection = sec("Finanzas", [
      { label: "Ventas", href: "/app/owner/sales", icon: "sales" },
      { label: "Gastos", href: "/app/owner/expenses", icon: "expenses" },
      { label: "Retiros", href: "/app/owner/withdrawals", icon: "withdrawals" },
      { label: "Reportes", href: "/app/owner/reports", icon: "reports" },
  ], "finance");
  const adminOwner: NavSection = sec("Administración", [
      { label: "Usuarios", href: "/app/owner/users", icon: "users" },
      { label: "Ajustes", href: "/app/owner/settings", icon: "settings" },
  ], "settings");
  const tasksOps: NavSection = sec("Operación", [
      { label: "Tablero", href: "/app/ops/kanban/activities", icon: "kanban" },
      { label: "Tickets", href: "/app/ops/kanban/tickets", icon: "tasks" },
  ], "tasks");

  const apps: NavSection = sec("Apps / Servicios", [
      // <--- 2. Aquí agregamos el botón para que salga hasta arriba
      { label: "Reloj Checador", href: "/app/reloj", icon: "reloj", badge: "Nuevo" },
      { label: "Restaurante (POS)", href: "/app/restaurant", icon: "restaurant", badge: "Beta" },
      { label: "Hotel (PMS)", href: "/app/hotel", icon: "hotel", badge: "Próx" },
      { label: "Museos", href: "/app/museums", icon: "museum", badge: "Próx" },
      { label: "Aventura / Rancho", href: "/app/adventure", icon: "adventure", badge: "Próx" },
      { label: "Inventario", href: "/app/inventory", icon: "inventory", badge: "Beta" },
      { label: "Nómina", href: "/app/payroll", icon: "payroll", badge: "Próx" },
      { label: "IoT / Flotilla", href: "/app/iot", icon: "iot", badge: "Próx" },
      { label: "Hotel · Dashboard", href: "/app/hotel/dashboard", icon: "hotel", badge: "Beta" },
      { label: "Hotel · Calendario", href: "/app/hotel/calendar", icon: "hotel", badge: "Beta" },
      { label: "Hotel · Folios", href: "/app/hotel/folio", icon: "hotel", badge: "Beta" },
  ], "apps");

  const managerDash: NavSection = sec("Ejecutivo", [{ label: "Dashboard", href: "/app/manager", icon: "dashboard" }], "dashboard");
  const financeManager: NavSection = sec("Finanzas", [
      { label: "Ventas", href: "/app/manager/sales", icon: "sales" },
      { label: "Gastos", href: "/app/manager/expenses", icon: "expenses" },
      { label: "Retiros", href: "/app/manager/withdrawals", icon: "withdrawals" },
      { label: "Reportes", href: "/app/manager/reports", icon: "reports" },
  ], "finance");

  const accounting: NavSection[] = [
    sec("Contabilidad", [{ label: "Panel", href: "/app/accounting", icon: "dashboard" }], "dashboard"),
    sec("Procesos", [
        { label: "Exportes", href: "/app/accounting/exports", icon: "withdrawals" },
        { label: "Cierres", href: "/app/accounting/periods", icon: "reports" },
    ], "reports"),
  ];

  const opsMinimal: NavSection[] = [
    sec("Operación", [{ label: "Tablero", href: "/app/ops/kanban/activities", icon: "kanban" }], "tasks"),
    sec("Captura", [
        { label: "Venta", href: "/app/ops/sale", icon: "sales" },
        { label: "Gasto", href: "/app/ops/expense", icon: "expenses" },
    ], "finance"),
  ];

  const restaurantStaff: NavSection[] = [
    sec("Restaurante", [
        { label: "POS", href: "/app/restaurant/pos", icon: "pos" },
        { label: "Mesas", href: "/app/restaurant/tables", icon: "tables" },
        { label: "Menú", href: "/app/restaurant/menu", icon: "menu" },
        { label: "KDS", href: "/app/restaurant/kds", icon: "kds" },
        { label: "Reportes", href: "/app/restaurant/reports", icon: "reports" },
    ], "restaurant"),
  ];

  if (role === "MASTER_ADMIN" || role === "OWNER") return [executive, financeOwner, tasksOps, apps, adminOwner];
  if (role === "ACCOUNTING") return accounting;
  if (role === "SUPERIOR" || role === "MANAGER") return [managerDash, financeManager, tasksOps, apps];
  if (role === "STAFF_KITCHEN" || role === "STAFF_BAR" || role === "STAFF_WAITER") return [...restaurantStaff, ...opsMinimal, apps];
  return [...opsMinimal, apps];
}
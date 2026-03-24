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
  | "reloj";

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

/**
 * ✅ Navbar por rol (Control de Acceso Dinámico)
 */
export function getNavByRole(role: string): NavSection[] {
  // ==========================================
  // 1. SECCIONES UNIVERSALES (Para todos)
  // ==========================================
  const personal: NavSection = sec("Mi Espacio", [
    { label: "Reloj Checador", href: "/app/reloj", icon: "reloj" },
    { label: "Mis Tareas", href: "/app/ops/kanban/activities", icon: "kanban" },
    { label: "Tickets", href: "/app/ops/kanban/tickets", icon: "tasks" },
  ], "users");

  // ==========================================
  // 2. BLOQUES DE CONSTRUCCIÓN (Módulos)
  // ==========================================
  
  // -- DIRECTIVOS Y ADMIN --
  const executive: NavSection = sec("Ejecutivo", [{ label: "Dashboard", href: "/app/owner", icon: "dashboard" }], "dashboard");
  const adminManager: NavSection = sec("Administración", [
    { label: "Directorio", href: "/app/owner/users", icon: "users" },
    { label: "Nómina y Asistencias", href: "/app/payroll", icon: "payroll" },
    { label: "Ajustes del Sistema", href: "/app/owner/settings", icon: "settings" },
  ], "settings");

  // -- FINANZAS Y CONTABILIDAD --
  const financeOwner: NavSection = sec("Finanzas", [
    { label: "Ventas Generales", href: "/app/owner/sales", icon: "sales" },
    { label: "Gastos", href: "/app/owner/expenses", icon: "expenses" },
    { label: "Retiros de Caja", href: "/app/owner/withdrawals", icon: "withdrawals" },
    { label: "Reportes", href: "/app/owner/reports", icon: "reports" },
  ], "finance");

  const accounting: NavSection = sec("Contabilidad", [
    { label: "Panel Contable", href: "/app/accounting", icon: "dashboard" },
    { label: "Exportes", href: "/app/accounting/exports", icon: "withdrawals" },
    { label: "Cierres", href: "/app/accounting/periods", icon: "reports" },
  ], "reports");

  // -- RESTAURANTE --
  const restAdmin: NavSection = sec("Restaurante", [
    { label: "Punto de Venta", href: "/app/restaurant/pos", icon: "pos" },
    { label: "Mapa de Mesas", href: "/app/restaurant/tables", icon: "tables" },
    { label: "KDS (Cocina)", href: "/app/restaurant/kds", icon: "kds" },
    { label: "Editor de Menú", href: "/app/restaurant/menu", icon: "menu" },
    { label: "Reportes Rest.", href: "/app/restaurant/reports", icon: "reports" },
  ], "restaurant");

  const restStaff: NavSection = sec("Restaurante", [
    { label: "Punto de Venta", href: "/app/restaurant/pos", icon: "pos" },
    { label: "Mesas", href: "/app/restaurant/tables", icon: "tables" },
  ], "restaurant");

  const restKitchen: NavSection = sec("Cocina y Barra", [
    { label: "Pantalla KDS", href: "/app/restaurant/kds", icon: "kds" },
  ], "restaurant");

// -- HOTEL Y RESERVAS --
  const hotelAdmin: NavSection = sec("Hotel & Reservas", [
    { label: "Dashboard", href: "/app/hotel/dashboard", icon: "dashboard" },
    { label: "Calendario", href: "/app/hotel/calendar", icon: "hotel" },
    { label: "Habitaciones", href: "/app/hotel/rooms", icon: "hotel" }, // <--- AGREGADO AQUÍ
    { label: "Folios y Cuentas", href: "/app/hotel/folio", icon: "reports" as any }, 
  ], "hotel");

  // -- ALMACÉN Y TIENDITA --
  const inventory: NavSection = sec("Almacén", [
    { label: "Inventarios", href: "/app/inventory", icon: "inventory" },
  ], "inventory");

  const store: NavSection = sec("Tiendita", [
    { label: "Caja Tiendita", href: "/app/store/pos", icon: "pos", badge: "Nuevo" },
  ], "sales");

  // -- RANCHO Y EXPERIENCIAS --
  const ranch: NavSection = sec("Rancho", [
    { label: "Experiencias", href: "/app/adventure", icon: "adventure" },
  ], "adventure");


  // ==========================================
  // 3. ASIGNACIÓN POR ROL (La magia)
  // ==========================================

  // Dueños y Directores ven TODO
  if (role === "MASTER_ADMIN" || role === "OWNER") {
    return [personal, executive, financeOwner, hotelAdmin, restAdmin, inventory, store, ranch, adminManager];
  }

  // Gerencia Operativa
  if (role === "MANAGER_OPS") {
    return [personal, financeOwner, hotelAdmin, restAdmin, inventory, ranch];
  }

  // Contabilidad
  if (role === "ACCOUNTING") {
    return [personal, accounting, financeOwner, inventory];
  }

  // Ventas y Reservas
  if (role === "SALES" || role === "RESERVATIONS") {
    return [personal, hotelAdmin, ranch];
  }

  // Almacén
  if (role === "INVENTORY") {
    return [personal, inventory];
  }

  // Gerente de Restaurante y Cajeros
  if (role === "MANAGER_RESTAURANT" || role === "STAFF_CASHIER") {
    const finBasic = sec("Caja", [{ label: "Retiros y Cortes", href: "/app/owner/withdrawals", icon: "withdrawals" }], "finance");
    return [personal, finBasic, restAdmin];
  }

  // Meseros
  if (role === "STAFF_WAITER") {
    return [personal, restStaff];
  }

  // Barra y Cocina
  if (role === "STAFF_BAR" || role === "STAFF_KITCHEN") {
    return [personal, restKitchen];
  }

  // Recepción Hotel
  if (role === "MANAGER_HOTEL" || role === "STAFF_RECEPTION") {
    return [personal, hotelAdmin];
  }

  // Tiendita
  if (role === "STAFF_STORE") {
    return [personal, store];
  }

  // Por defecto (Mantenimiento, Caballerangos, Recamaristas, etc.)
  return [personal];
}
export type Role =
  // Generales / Directivos
  | "MASTER_ADMIN"
  | "OWNER"
  | "MANAGER_OPS" // Gerente Operadora
  | "ACCOUNTING"  // Contabilidad
  
  // Operadora / Ventas
  | "SALES"         // Ejecutiva de Ventas
  | "RESERVATIONS"  // Encargada de Reservas
  | "INVENTORY"     // Almacenista
  | "STAFF_MAINTENANCE" // Mantenimiento / Choferes

  // Restaurante
  | "MANAGER_RESTAURANT" // Gerente/Capitán
  | "STAFF_CASHIER"      // Cajero(a)
  | "STAFF_WAITER"       // Mesero/a
  | "STAFF_BAR"          // Barra
  | "STAFF_KITCHEN"      // Cocina
  
  // Hotel
  | "MANAGER_HOTEL"      // Gerente de Hotel
  | "STAFF_RECEPTION"    // Recepcionista
  | "STAFF_HOUSEKEEPING" // Recamarista
  
  // Rancho / Experiencias
  | "MANAGER_RANCH"      // Gerente de Rancho
  | "STAFF_EXPERIENCES"  // Guías
  | "STAFF_FIELD"        // Caballerango / Asistente

  // Tiendita / Retail
  | "STAFF_STORE"        // Mostrador Tiendita
  
  // (Legado - Mantener para no romper usuarios antiguos)
  | "SUPERIOR"
  | "MANAGER";

export type Permission =
  // Admin / RRHH
  | "ADMIN_USERS_VIEW"
  | "ADMIN_USERS_EDIT"
  | "ADMIN_USERS_DELETE"
  | "ADMIN_SETTINGS_VIEW"
  | "ADMIN_SETTINGS_EDIT"
  | "ADMIN_PAYROLL_VIEW" // Ver checador de todos
  | "ADMIN_PAYROLL_EDIT"

  // Finanzas
  | "FIN_SALES_VIEW"
  | "FIN_SALES_EXPORT"
  | "FIN_EXPENSES_VIEW"
  | "FIN_EXPENSES_CREATE"
  | "FIN_EXPENSES_APPROVE"
  | "FIN_WITHDRAWALS_VIEW"
  | "FIN_WITHDRAWALS_CREATE"
  | "FIN_WITHDRAWALS_APPROVE"
  | "FIN_REPORTS_VIEW"

  // Restaurante
  | "REST_POS_VIEW"
  | "REST_POS_CHARGE"
  | "REST_POS_DISCOUNT"
  | "REST_POS_CANCEL_ITEM"
  | "REST_POS_CANCEL_ORDER"
  | "REST_TABLES_VIEW"
  | "REST_TABLES_EDIT"
  | "REST_MENU_VIEW"
  | "REST_MENU_EDIT"
  | "REST_MENU_DELETE"
  | "REST_KDS_VIEW"
  | "REST_KDS_UPDATE"
  | "REST_REPORTS_VIEW"

  // Hotel & Reservaciones
  | "HOTEL_VIEW"
  | "HOTEL_EDIT"
  | "RESERVATIONS_VIEW"
  | "RESERVATIONS_CREATE"
  | "RESERVATIONS_EDIT"

  // Tiendita
  | "STORE_POS_VIEW"
  | "STORE_POS_CHARGE"

  // Inventario
  | "INVENTORY_VIEW"
  | "INVENTORY_EDIT"

  // Operación / Tareas
  | "OPS_TASKS_VIEW"
  | "OPS_TASKS_EDIT";

export const ROLE_LABEL: Record<Role, string> = {
  MASTER_ADMIN: "Master Admin",
  OWNER: "Dueño / Propietario",
  MANAGER_OPS: "Gerente Operadora",
  ACCOUNTING: "Contabilidad",
  
  SALES: "Ventas",
  RESERVATIONS: "Reservaciones",
  INVENTORY: "Almacén e Inventario",
  STAFF_MAINTENANCE: "Mantenimiento",

  MANAGER_RESTAURANT: "Gerente Restaurante",
  STAFF_CASHIER: "Cajero(a)",
  STAFF_WAITER: "Mesero/a",
  STAFF_BAR: "Barra / Bartender",
  STAFF_KITCHEN: "Cocina",

  MANAGER_HOTEL: "Gerente Hotel",
  STAFF_RECEPTION: "Recepcionista",
  STAFF_HOUSEKEEPING: "Recamarista",

  MANAGER_RANCH: "Gerente Rancho",
  STAFF_EXPERIENCES: "Experiencias",
  STAFF_FIELD: "Caballerango",

  STAFF_STORE: "Mostrador Tiendita",

  SUPERIOR: "Superior (Legado)",
  MANAGER: "Manager (Legado)",
};

/**
 * ✅ Matriz de Permisos
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ==========================================
  // 1. DIRECTIVOS (Tienen todo)
  // ==========================================
  MASTER_ADMIN: [
    "ADMIN_USERS_VIEW", "ADMIN_USERS_EDIT", "ADMIN_USERS_DELETE", "ADMIN_SETTINGS_VIEW", "ADMIN_SETTINGS_EDIT", "ADMIN_PAYROLL_VIEW", "ADMIN_PAYROLL_EDIT",
    "FIN_SALES_VIEW", "FIN_SALES_EXPORT", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "FIN_EXPENSES_APPROVE", "FIN_WITHDRAWALS_VIEW", "FIN_WITHDRAWALS_CREATE", "FIN_WITHDRAWALS_APPROVE", "FIN_REPORTS_VIEW",
    "REST_POS_VIEW", "REST_POS_CHARGE", "REST_POS_DISCOUNT", "REST_POS_CANCEL_ITEM", "REST_POS_CANCEL_ORDER", "REST_TABLES_VIEW", "REST_TABLES_EDIT", "REST_MENU_VIEW", "REST_MENU_EDIT", "REST_MENU_DELETE", "REST_KDS_VIEW", "REST_KDS_UPDATE", "REST_REPORTS_VIEW",
    "HOTEL_VIEW", "HOTEL_EDIT", "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "RESERVATIONS_EDIT",
    "STORE_POS_VIEW", "STORE_POS_CHARGE", "INVENTORY_VIEW", "INVENTORY_EDIT", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  OWNER: [
    "ADMIN_USERS_VIEW", "ADMIN_USERS_EDIT", "ADMIN_USERS_DELETE", "ADMIN_SETTINGS_VIEW", "ADMIN_SETTINGS_EDIT", "ADMIN_PAYROLL_VIEW", "ADMIN_PAYROLL_EDIT",
    "FIN_SALES_VIEW", "FIN_SALES_EXPORT", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "FIN_EXPENSES_APPROVE", "FIN_WITHDRAWALS_VIEW", "FIN_WITHDRAWALS_CREATE", "FIN_WITHDRAWALS_APPROVE", "FIN_REPORTS_VIEW",
    "REST_POS_VIEW", "REST_POS_CHARGE", "REST_POS_DISCOUNT", "REST_POS_CANCEL_ITEM", "REST_POS_CANCEL_ORDER", "REST_TABLES_VIEW", "REST_TABLES_EDIT", "REST_MENU_VIEW", "REST_MENU_EDIT", "REST_MENU_DELETE", "REST_KDS_VIEW", "REST_KDS_UPDATE", "REST_REPORTS_VIEW",
    "HOTEL_VIEW", "HOTEL_EDIT", "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "RESERVATIONS_EDIT",
    "STORE_POS_VIEW", "STORE_POS_CHARGE", "INVENTORY_VIEW", "INVENTORY_EDIT", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  MANAGER_OPS: [
    "ADMIN_USERS_VIEW", "ADMIN_PAYROLL_VIEW",
    "FIN_SALES_VIEW", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "FIN_EXPENSES_APPROVE", "FIN_WITHDRAWALS_VIEW", "FIN_REPORTS_VIEW",
    "REST_POS_VIEW", "REST_TABLES_VIEW", "REST_MENU_VIEW", "REST_REPORTS_VIEW",
    "HOTEL_VIEW", "RESERVATIONS_VIEW", "INVENTORY_VIEW", "INVENTORY_EDIT", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  ACCOUNTING: [
    "ADMIN_PAYROLL_VIEW",
    "FIN_SALES_VIEW", "FIN_SALES_EXPORT", "FIN_EXPENSES_VIEW", "FIN_WITHDRAWALS_VIEW", "FIN_REPORTS_VIEW",
    "INVENTORY_VIEW"
  ],

  // ==========================================
  // 2. OPERADORA / VENTAS (Ventas hereda de Reservas)
  // ==========================================
  SALES: [
    // Ventas puede ver TODO lo de reservas y crearlas
    "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "RESERVATIONS_EDIT", "HOTEL_VIEW",
    // Y además sus permisos de ventas
    "FIN_SALES_VIEW", "FIN_REPORTS_VIEW", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  RESERVATIONS: [
    "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "RESERVATIONS_EDIT", "HOTEL_VIEW", "OPS_TASKS_VIEW"
  ],
  INVENTORY: [
    "INVENTORY_VIEW", "INVENTORY_EDIT", "OPS_TASKS_VIEW"
  ],
  STAFF_MAINTENANCE: [
    "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],

  // ==========================================
  // 3. RESTAURANTE
  // ==========================================
  MANAGER_RESTAURANT: [
    "FIN_SALES_VIEW", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "FIN_WITHDRAWALS_VIEW", "FIN_WITHDRAWALS_CREATE", "FIN_REPORTS_VIEW",
    "REST_POS_VIEW", "REST_POS_CHARGE", "REST_POS_DISCOUNT", "REST_POS_CANCEL_ITEM", "REST_TABLES_VIEW", "REST_TABLES_EDIT", "REST_MENU_VIEW", "REST_KDS_VIEW", "REST_REPORTS_VIEW", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  STAFF_CASHIER: [
    "FIN_SALES_VIEW", "FIN_WITHDRAWALS_CREATE",
    "REST_POS_VIEW", "REST_POS_CHARGE", "REST_TABLES_VIEW", "OPS_TASKS_VIEW"
  ],
  STAFF_WAITER: [
    "REST_POS_VIEW", "REST_TABLES_VIEW", "REST_MENU_VIEW", "REST_KDS_VIEW", "OPS_TASKS_VIEW"
  ],
  STAFF_BAR: [
    "REST_POS_VIEW", "REST_TABLES_VIEW", "REST_MENU_VIEW", "REST_KDS_VIEW", "REST_KDS_UPDATE", "OPS_TASKS_VIEW"
  ],
  STAFF_KITCHEN: [
    "REST_KDS_VIEW", "REST_KDS_UPDATE", "REST_MENU_VIEW", "OPS_TASKS_VIEW"
  ],

  // ==========================================
  // 4. HOTEL
  // ==========================================
  MANAGER_HOTEL: [
    "FIN_SALES_VIEW", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "FIN_REPORTS_VIEW",
    "HOTEL_VIEW", "HOTEL_EDIT", "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "RESERVATIONS_EDIT", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  STAFF_RECEPTION: [
    "HOTEL_VIEW", "HOTEL_EDIT", "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "OPS_TASKS_VIEW", "REST_POS_VIEW" // Tienen POS para cobrar cositas
  ],
  STAFF_HOUSEKEEPING: [
    "HOTEL_VIEW", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],

  // ==========================================
  // 5. RANCHO
  // ==========================================
  MANAGER_RANCH: [
    "FIN_SALES_VIEW", "FIN_EXPENSES_VIEW", "FIN_EXPENSES_CREATE", "RESERVATIONS_VIEW", "RESERVATIONS_CREATE", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  STAFF_EXPERIENCES: [
    "RESERVATIONS_VIEW", "OPS_TASKS_VIEW", "OPS_TASKS_EDIT"
  ],
  STAFF_FIELD: [
    "OPS_TASKS_VIEW"
  ],

  // ==========================================
  // 6. TIENDITA
  // ==========================================
  STAFF_STORE: [
    "STORE_POS_VIEW", "STORE_POS_CHARGE", "INVENTORY_VIEW", "OPS_TASKS_VIEW"
  ],

  // ==========================================
  // ROLES LEGADO (Para que no exploten los actuales)
  // ==========================================
  SUPERIOR: [ "FIN_SALES_VIEW", "OPS_TASKS_VIEW" ],
  MANAGER: [ "FIN_SALES_VIEW", "OPS_TASKS_VIEW" ],
};

export function permissionsForRole(role?: string): Permission[] {
  const r = (role || "STAFF_WAITER") as Role;
  return ROLE_PERMISSIONS[r] ?? [];
}

export function hasPermission(role: string | undefined, perm: Permission): boolean {
  return permissionsForRole(role).includes(perm);
}

export function hasAny(role: string | undefined, perms: Permission[]): boolean {
  const set = new Set(permissionsForRole(role));
  return perms.some((p) => set.has(p));
}
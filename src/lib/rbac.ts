export type Role =
  | "MASTER_ADMIN"
  | "OWNER"
  | "SUPERIOR"
  | "MANAGER"
  | "ACCOUNTING"
  | "STAFF_WAITER"
  | "STAFF_BAR"
  | "STAFF_KITCHEN"
  | "STAFF_RECEPTION"
  | "STAFF_EXPERIENCES";

export type Permission =
  // Admin / sistema
  | "ADMIN_USERS_VIEW"
  | "ADMIN_USERS_EDIT"
  | "ADMIN_USERS_DELETE"
  | "ADMIN_SETTINGS_VIEW"
  | "ADMIN_SETTINGS_EDIT"

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

  // Operación / Kanban
  | "OPS_TASKS_VIEW"
  | "OPS_TASKS_EDIT";

export const ROLE_LABEL: Record<Role, string> = {
  MASTER_ADMIN: "Master Admin",
  OWNER: "Owner",
  SUPERIOR: "Superior",
  MANAGER: "Manager",
  ACCOUNTING: "Contabilidad",
  STAFF_WAITER: "Mesero/a",
  STAFF_BAR: "Barra",
  STAFF_KITCHEN: "Cocina",
  STAFF_RECEPTION: "Recepción",
  STAFF_EXPERIENCES: "Experiencias",
};

/**
 * ✅ Matriz de permisos por rol
 * Ajusta aquí todo el comportamiento de acceso.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MASTER_ADMIN: [
    // admin
    "ADMIN_USERS_VIEW",
    "ADMIN_USERS_EDIT",
    "ADMIN_USERS_DELETE",
    "ADMIN_SETTINGS_VIEW",
    "ADMIN_SETTINGS_EDIT",

    // finanzas
    "FIN_SALES_VIEW",
    "FIN_SALES_EXPORT",
    "FIN_EXPENSES_VIEW",
    "FIN_EXPENSES_CREATE",
    "FIN_EXPENSES_APPROVE",
    "FIN_WITHDRAWALS_VIEW",
    "FIN_WITHDRAWALS_CREATE",
    "FIN_WITHDRAWALS_APPROVE",
    "FIN_REPORTS_VIEW",

    // restaurante
    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    "REST_POS_DISCOUNT",
    "REST_POS_CANCEL_ITEM",
    "REST_POS_CANCEL_ORDER",
    "REST_TABLES_VIEW",
    "REST_TABLES_EDIT",
    "REST_MENU_VIEW",
    "REST_MENU_EDIT",
    "REST_MENU_DELETE",
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE",
    "REST_REPORTS_VIEW",

    // ops
    "OPS_TASKS_VIEW",
    "OPS_TASKS_EDIT",
  ],

  OWNER: [
    // admin
    "ADMIN_USERS_VIEW",
    "ADMIN_USERS_EDIT",
    "ADMIN_USERS_DELETE",
    "ADMIN_SETTINGS_VIEW",
    "ADMIN_SETTINGS_EDIT",

    // finanzas
    "FIN_SALES_VIEW",
    "FIN_SALES_EXPORT",
    "FIN_EXPENSES_VIEW",
    "FIN_EXPENSES_CREATE",
    "FIN_EXPENSES_APPROVE",
    "FIN_WITHDRAWALS_VIEW",
    "FIN_WITHDRAWALS_CREATE",
    "FIN_WITHDRAWALS_APPROVE",
    "FIN_REPORTS_VIEW",

    // restaurante
    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    "REST_POS_DISCOUNT",
    "REST_POS_CANCEL_ITEM",
    "REST_POS_CANCEL_ORDER",
    "REST_TABLES_VIEW",
    "REST_TABLES_EDIT",
    "REST_MENU_VIEW",
    "REST_MENU_EDIT",
    "REST_MENU_DELETE",
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE",
    "REST_REPORTS_VIEW",

    // ops
    "OPS_TASKS_VIEW",
    "OPS_TASKS_EDIT",
  ],

  SUPERIOR: [
    // sin admin
    "FIN_SALES_VIEW",
    "FIN_SALES_EXPORT",
    "FIN_EXPENSES_VIEW",
    "FIN_EXPENSES_CREATE",
    "FIN_EXPENSES_APPROVE",
    "FIN_WITHDRAWALS_VIEW",
    "FIN_WITHDRAWALS_CREATE",
    "FIN_WITHDRAWALS_APPROVE",
    "FIN_REPORTS_VIEW",

    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    "REST_POS_DISCOUNT",
    "REST_POS_CANCEL_ITEM",
    "REST_POS_CANCEL_ORDER",
    "REST_TABLES_VIEW",
    "REST_TABLES_EDIT",
    "REST_MENU_VIEW",
    "REST_MENU_EDIT",
    "REST_MENU_DELETE",
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE",
    "REST_REPORTS_VIEW",

    "OPS_TASKS_VIEW",
    "OPS_TASKS_EDIT",
  ],

  MANAGER: [
    // finanzas limitado
    "FIN_SALES_VIEW",
    "FIN_EXPENSES_VIEW",
    "FIN_EXPENSES_CREATE",
    "FIN_WITHDRAWALS_VIEW",
    "FIN_WITHDRAWALS_CREATE",
    "FIN_REPORTS_VIEW",

    // restaurante
    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    "REST_POS_DISCOUNT",
    "REST_POS_CANCEL_ITEM",
    // cancelar orden completa se lo quitamos al manager (puedes regresarlo si quieres)
    // "REST_POS_CANCEL_ORDER",
    "REST_TABLES_VIEW",
    "REST_TABLES_EDIT",
    "REST_MENU_VIEW",
    "REST_MENU_EDIT",
    // borrar definitivo NO
    // "REST_MENU_DELETE",
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE",
    "REST_REPORTS_VIEW",

    "OPS_TASKS_VIEW",
    "OPS_TASKS_EDIT",
  ],

  ACCOUNTING: [
    "FIN_SALES_VIEW",
    "FIN_SALES_EXPORT",
    "FIN_EXPENSES_VIEW",
    "FIN_WITHDRAWALS_VIEW",
    "FIN_REPORTS_VIEW",
  ],

  STAFF_WAITER: [
    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    // descuento/cancelaciones no por default
    "REST_TABLES_VIEW",
    "REST_MENU_VIEW",
    "REST_KDS_VIEW",
    "REST_REPORTS_VIEW", // si no quieres, quítalo
    "OPS_TASKS_VIEW",
  ],

  STAFF_BAR: [
    "REST_POS_VIEW",
    "REST_POS_CHARGE",
    "REST_TABLES_VIEW",
    "REST_MENU_VIEW",
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE", // barra puede marcar “READY” para bebidas
    "REST_REPORTS_VIEW",
    "OPS_TASKS_VIEW",
  ],

  STAFF_KITCHEN: [
    "REST_KDS_VIEW",
    "REST_KDS_UPDATE",
    "REST_MENU_VIEW",
    "REST_TABLES_VIEW",
    "OPS_TASKS_VIEW",
  ],

  STAFF_RECEPTION: [
    "REST_POS_VIEW",
    "REST_TABLES_VIEW",
    "REST_MENU_VIEW",
    "OPS_TASKS_VIEW",
  ],

  STAFF_EXPERIENCES: [
    "OPS_TASKS_VIEW",
    "OPS_TASKS_EDIT",
  ],
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
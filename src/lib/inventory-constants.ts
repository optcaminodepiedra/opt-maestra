/**
 * ID fijo del negocio "Almacén General" (Goyo).
 * Se crea en supabase-fase7c.sql.
 */
export const ALMACEN_GENERAL_ID = "almacen_general_001";
export const ALMACEN_GENERAL_NAME = "Almacén General";

/**
 * Tipos de requisición que NO requieren un negocio operativo
 * (usan Almacén General como businessId).
 */
export const NON_OPERATIONAL_KINDS = ["OWNER_HOUSE", "VENDING_MACHINE"] as const;

/**
 * ¿Este tipo de requisición se asocia a un negocio operativo?
 */
export function requiresOperationalBusiness(kind: string): boolean {
  return !NON_OPERATIONAL_KINDS.includes(kind as any);
}

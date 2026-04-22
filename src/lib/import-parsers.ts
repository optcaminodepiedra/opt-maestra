// Normalizadores para parsear valores de Excel/CSV de forma flexible

/**
 * Parsea una fecha en múltiples formatos:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - Excel serial number (42370.5, etc)
 */
export function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  // Excel serial (número)
  if (typeof value === "number") {
    // Excel fechas: días desde 1900-01-01 (con el bug del 1900)
    if (value > 1 && value < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const ms = value * 24 * 60 * 60 * 1000;
      return new Date(excelEpoch.getTime() + ms);
    }
  }

  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  if (!str) return null;

  // YYYY-MM-DD o YYYY/MM/DD
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY o DD-MM-YYYY
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, parseInt(m[2]) - 1, parseInt(m[1])));
    return isNaN(d.getTime()) ? null : d;
  }

  // Último recurso: el parser nativo
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Combina fecha + hora HH:MM en un solo Date UTC
 */
export function combineDateTime(dateVal: unknown, timeVal: unknown): Date | null {
  const date = parseDate(dateVal);
  if (!date) return null;

  const t = String(timeVal ?? "").trim();
  if (!t) {
    // Sin hora: asumimos 12:00 (mediodía)
    date.setUTCHours(12, 0, 0, 0);
    return date;
  }

  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    date.setUTCHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
  } else {
    date.setUTCHours(12, 0, 0, 0);
  }
  return date;
}

/**
 * Parsea un monto a centavos (enteros)
 * Acepta: "1500.50", "1500,50", "$1,500.50", "1500", números
 */
export function parseMoneyCents(value: unknown): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    if (!isFinite(value) || isNaN(value)) return null;
    return Math.round(value * 100);
  }

  let str = String(value).trim();
  if (!str) return null;

  // Remover símbolos de moneda y espacios
  str = str.replace(/[$\s]/g, "");

  // Detectar formato europeo vs americano
  const hasDot = str.includes(".");
  const hasComma = str.includes(",");

  if (hasDot && hasComma) {
    // "1,500.50" o "1.500,50"
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // europeo: "1.500,50" → "1500.50"
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // americano: "1,500.50" → "1500.50"
      str = str.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // "1500,50" (europeo) o "1,500" (americano con miles)
    // Heurística: si después de la coma hay exactamente 1-2 dígitos, es decimal
    const match = str.match(/,(\d{1,2})$/);
    if (match) {
      str = str.replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }

  const n = parseFloat(str);
  if (isNaN(n) || !isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Parsea un entero
 */
export function parseInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Math.floor(value);
  const n = parseInt(String(value).trim(), 10);
  return isNaN(n) ? null : n;
}

/**
 * Parsea un booleano flexiblemente
 * Acepta: true/false, sí/no, si/no, 1/0, yes/no, "incluye"/"no incluye"
 */
export function parseBool(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const s = String(value).trim().toLowerCase();
  return ["true", "1", "sí", "si", "yes", "y", "x", "true", "verdadero", "incluye"].includes(s);
}

/**
 * Normaliza string: trim, elimina dobles espacios
 */
export function normString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

/**
 * Parsea un enum con alias en español/inglés
 */
export function parseEnum<T extends string>(
  value: unknown,
  map: Record<string, T>,
  defaultValue: T | null = null
): T | null {
  if (value == null || value === "") return defaultValue;
  const key = String(value).trim().toLowerCase();
  for (const [alias, target] of Object.entries(map)) {
    if (alias.toLowerCase() === key) return target;
  }
  return defaultValue;
}

/**
 * Mapa de aliases para método de pago
 */
export const PAYMENT_METHOD_MAP: Record<string, "CASH" | "CARD" | "TRANSFER"> = {
  cash: "CASH",
  efectivo: "CASH",
  efe: "CASH",
  "efe.": "CASH",
  cash_payment: "CASH",
  card: "CARD",
  tarjeta: "CARD",
  tdc: "CARD",
  tdd: "CARD",
  credito: "CARD",
  debito: "CARD",
  transfer: "TRANSFER",
  transferencia: "TRANSFER",
  spei: "TRANSFER",
  deposito: "TRANSFER",
};

/**
 * Mapa de aliases para tipo de retiro
 */
export const WITHDRAWAL_KIND_MAP: Record<string, "PETTY_CASH" | "LARGE_REQUEST"> = {
  petty_cash: "PETTY_CASH",
  "caja_chica": "PETTY_CASH",
  "caja chica": "PETTY_CASH",
  chica: "PETTY_CASH",
  pequeño: "PETTY_CASH",
  pequeno: "PETTY_CASH",
  large_request: "LARGE_REQUEST",
  "retiro_grande": "LARGE_REQUEST",
  "retiro grande": "LARGE_REQUEST",
  grande: "LARGE_REQUEST",
  grande_request: "LARGE_REQUEST",
};

/**
 * Mapa de aliases para estado de reservación
 */
export const RESERVATION_STATUS_MAP: Record<string, string> = {
  pending: "PENDING",
  pendiente: "PENDING",
  confirmed: "CONFIRMED",
  confirmada: "CONFIRMED",
  checked_in: "CHECKED_IN",
  "check-in": "CHECKED_IN",
  "hospedado": "CHECKED_IN",
  checked_out: "CHECKED_OUT",
  "check-out": "CHECKED_OUT",
  "completada": "CHECKED_OUT",
  canceled: "CANCELED",
  cancelled: "CANCELED",
  cancelada: "CANCELED",
};

/**
 * Genera un username a partir de un nombre
 * "María González Ruiz" → "maria.gonzalez"
 */
export function generateUsername(fullName: string): string {
  const parts = fullName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "usuario";
  if (parts.length === 1) return parts[0].slice(0, 20);
  return `${parts[0]}.${parts[1]}`.slice(0, 30);
}

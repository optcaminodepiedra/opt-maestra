// src/lib/softrestaurant-parser.ts
//
// Parser para los archivos XML de SoftRestaurant (formato VFPData/FoxPro).
// Estructura típica:
//   <?xml version="1.0" encoding="Windows-1252" standalone="yes"?>
//   <VFPData>
//     <xsd:schema>...</xsd:schema>
//     <curcheqdet>
//       <foliodet>14449</foliodet>
//       <movimiento>2</movimiento>
//       ...
//     </curcheqdet>
//     ...
//   </VFPData>

/**
 * Decodifica un Buffer/ArrayBuffer/string a UTF-8.
 * Los XMLs de SoftRestaurant vienen en Windows-1252.
 */
export function decodeWindows1252(input: ArrayBuffer | Uint8Array | string): string {
  if (typeof input === "string") return input;
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  // TextDecoder soporta windows-1252 nativamente
  return new TextDecoder("windows-1252").decode(bytes);
}

/**
 * Extrae todos los registros de un nodo VFPData.
 *
 * Ejemplo:
 *   parseVFP(xml, "curcheqdet")
 *   → [{foliodet:"14449", movimiento:"2", ...}, ...]
 *
 * No usa DOMParser (que no existe en server actions) ni xml2js (peso extra).
 * Parser regex manual optimizado para el formato simple/conocido de SR.
 */
export function parseVFPRecords(
  xml: string,
  rootName: string
): Record<string, string>[] {
  const records: Record<string, string>[] = [];

  // Buscar todos los bloques <rootName>...</rootName>
  const blockRegex = new RegExp(`<${rootName}>([\\s\\S]*?)</${rootName}>`, "g");
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    const record: Record<string, string> = {};

    // Extraer cada <campo>valor</campo> o <campo/> (vacío)
    const fieldRegex = /<(\w+)(?:\s+[^>]*)?>([^<]*)<\/\1>|<(\w+)(?:\s+[^>]*)?\/>/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const name = fieldMatch[1] || fieldMatch[3];
      const value = fieldMatch[2] !== undefined ? fieldMatch[2] : "";
      record[name] = decodeXmlEntities(value.trim());
    }

    records.push(record);
  }

  return records;
}

/**
 * Decodifica entidades XML básicas
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ──────────────────────────────────────────────────────────────
// Helpers de tipo
// ──────────────────────────────────────────────────────────────

/** Convierte string a número (decimal con punto). Retorna 0 si vacío/inválido. */
export function asNum(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Convierte string a entero. Retorna 0 si vacío/inválido. */
export function asInt(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/** Convierte un decimal MXN (como "40.0000") a centavos enteros (4000). */
export function asCents(s: string | undefined | null): number {
  if (!s) return 0;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Convierte un string a boolean. SR usa "true"/"false". */
export function asBool(s: string | undefined | null): boolean {
  return s === "true" || s === "1";
}

/**
 * Convierte timestamp de SR ("2026-01-16T20:48:48") a Date.
 * Retorna null si vacío o inválido.
 */
export function asDate(s: string | undefined | null): Date | null {
  if (!s || s.trim() === "") return null;
  // SR usa formato ISO sin timezone — asumimos hora local de México
  // Para ser determinista, lo tratamos como UTC, ya que de cualquier forma
  // todo el sistema interno usa hora servidor.
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza un código de pago de SoftRestaurant a método interno.
 * SR usa muchas variantes: "EF", "EFECTIVO", "VISA", "MASTER", "AMEX",
 * "TARJETA", "TRANSFER", "BANCOMER", etc.
 */
export function normalizePaymentMethod(
  externalCode: string | null | undefined
): "CASH" | "CARD" | "TRANSFER" | null {
  if (!externalCode) return null;
  const c = externalCode.toUpperCase().trim();

  // Efectivo
  if (c === "EF" || c.startsWith("EFEC")) return "CASH";

  // Tarjetas (cualquier banco/tipo)
  const cardCodes = [
    "VISA", "MASTER", "MC", "AMEX", "AMERIC",
    "TARJ", "TC", "TD", "CRED", "DEB",
    "BANCOM", "BANAM", "BBVA", "HSBC",
    "SANTANDER", "AZTECA", "BANORTE", "SCOTIA",
    "MERCADO", "CLIP", "STRIPE",
  ];
  if (cardCodes.some((p) => c.includes(p))) return "CARD";

  // Transferencias (incluye CR de "Cuenta por Recibir/Crédito" y TR)
  const transferCodes = ["TRANSF", "SPEI", "DEPO", "PAYPAL", "TR", "CR"];
  if (transferCodes.includes(c) || transferCodes.some((p) => c.includes(p))) return "TRANSFER";

  // Vales / Crédito alimentos → los tratamos como CARD para fines de reporte
  // (en SR son montos no en efectivo, pero tampoco transferencia bancaria)
  if (c === "VAL" || c.includes("VALE")) return "CARD";

  // Default: si tiene la palabra "efec" → CASH, si no → null para que lo revisen
  return null;
}

/**
 * Parser para nombre de mesero (devuelve string limpio o null)
 */
export function asMeseroId(s: string | undefined | null): string | null {
  if (!s || !s.trim()) return null;
  return s.trim();
}

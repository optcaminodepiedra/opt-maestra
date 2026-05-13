/**
 * Parser XML para archivos VFPData (SoftRestaurant / Visual FoxPro export).
 *
 * Características:
 * - Detecta encoding Windows-1252 automáticamente
 * - Quita el bloque <xsd:schema> (definición que no contiene datos)
 * - Convierte cada registro a objeto JS con tipos correctos
 * - Devuelve {tableName, records} para que el caller sepa qué hacer
 *
 * Tipos detectados:
 * - dateTime: Date | null
 * - date: string YYYY-MM-DD | null
 * - decimal: number | null
 * - integer: number | null
 * - boolean: boolean
 * - string: string
 */

import { XMLParser } from "fast-xml-parser";

export type ParsedVfpFile = {
  tableName: string;          // ej: "curcheques", "curtemp"
  fileType: VfpFileType;      // ej: "cheques", "gastos"
  records: Record<string, any>[];
  totalRecords: number;
  schemaFields: Array<{ name: string; type: VfpFieldType }>;
};

export type VfpFileType =
  | "cheques"
  | "cheqdet"
  | "movtoscaja"
  | "turnos"
  | "cancela"
  | "movsinv"
  | "cuentasporcobrar"
  | "compras"
  | "gastos"
  | "hotelmovtos"
  | "facturas"
  | "bitacoratarjetacredito"
  | "unknown";

export type VfpFieldType =
  | "string"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "boolean";

/**
 * Detecta el tipo de archivo VFP basándose en el tagName de los records.
 * Cada archivo tiene un patrón distintivo.
 */
function detectFileType(tableName: string, fieldNames: string[]): VfpFileType {
  // Algunos archivos usan "curtemp" genérico — distinguir por campos
  if (tableName === "curcheques") return "cheques";
  if (tableName === "curcheqdet") return "cheqdet";
  if (tableName === "curmovtoscaja") return "movtoscaja";
  if (tableName === "curturnos") return "turnos";
  if (tableName === "curcancela") return "cancela";
  if (tableName === "curcuentasporcobrar") return "cuentasporcobrar";

  // tableName "curtemp" puede ser varios — detectar por campos
  if (tableName === "curtemp") {
    if (fieldNames.includes("proveedor") && fieldNames.includes("foliofactura")) return "compras";
    if (fieldNames.includes("idcuentacontable") && fieldNames.includes("descuento")) return "gastos";
    if (fieldNames.includes("habitacion") && fieldNames.includes("subtotal")) return "hotelmovtos";
    if (fieldNames.includes("invfisico") && fieldNames.includes("insumo")) return "movsinv";
  }

  if (fieldNames.includes("foliofactura") && fieldNames.includes("subtotal")) return "facturas";
  if (fieldNames.includes("numerotarjeta") && fieldNames.includes("autorizacion")) return "bitacoratarjetacredito";

  return "unknown";
}

/**
 * Extrae los campos definidos en el <xsd:schema> y sus tipos.
 */
function parseSchema(xmlContent: string): {
  tableName: string;
  fields: Array<{ name: string; type: VfpFieldType }>;
} {
  const fields: Array<{ name: string; type: VfpFieldType }> = [];
  let tableName = "unknown";

  // Buscar el primer <xsd:element name="X" minOccurs="0" maxOccurs="unbounded">
  // que define el row
  const rowMatch = xmlContent.match(/<xsd:element\s+name="([a-zA-Z]+)"\s+minOccurs="0"\s+maxOccurs="unbounded">/);
  if (rowMatch) tableName = rowMatch[1];

  // Capturar todos los <xsd:element name="campo" type="xsd:TIPO"/>
  // o <xsd:element name="campo">...<xsd:restriction base="xsd:TIPO">
  const elementRegex = /<xsd:element\s+name="([a-zA-Z0-9_]+)"(?:\s+type="xsd:([a-zA-Z]+)")?\s*(?:\/>|>(?:[\s\S]*?<xsd:restriction\s+base="xsd:([a-zA-Z]+)")?)/g;

  let match;
  while ((match = elementRegex.exec(xmlContent)) !== null) {
    const fieldName = match[1];
    const directType = match[2];
    const restrictionType = match[3];
    const xsdType = directType || restrictionType;

    // Skip los tipos genéricos
    if (fieldName === "VFPData" || fieldName === tableName) continue;

    let fieldType: VfpFieldType = "string";
    if (xsdType) {
      if (xsdType === "dateTime") fieldType = "dateTime";
      else if (xsdType === "date") fieldType = "date";
      else if (xsdType === "decimal") fieldType = "decimal";
      else if (xsdType === "integer") fieldType = "integer";
      else if (xsdType === "boolean") fieldType = "boolean";
    }

    fields.push({ name: fieldName, type: fieldType });
  }

  return { tableName, fields };
}

/**
 * Convierte un valor string al tipo correcto.
 */
function castValue(rawValue: any, type: VfpFieldType): any {
  if (rawValue === undefined || rawValue === null || rawValue === "") return null;
  const str = String(rawValue).trim();
  if (str === "") return null;

  switch (type) {
    case "boolean":
      return str === "true" || str === "1" || str.toLowerCase() === "yes";

    case "decimal":
    case "integer":
      const num = Number(str);
      return isNaN(num) ? null : num;

    case "dateTime":
      // Formato VFP: "2026-02-01T15:28:53"
      const dt = new Date(str);
      return isNaN(dt.getTime()) ? null : dt;

    case "date":
      // Formato: "2026-02-01"
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10); // YYYY-MM-DD como string
      }
      return null;

    case "string":
    default:
      return str;
  }
}

/**
 * Parsea un buffer de archivo XML VFPData.
 * Auto-detecta encoding Windows-1252 y devuelve estructura limpia.
 */
export function parseVfpXml(buffer: Buffer | ArrayBuffer): ParsedVfpFile {
  // Convertir buffer a string en Windows-1252 (encoding default de VFP)
  let xmlContent: string;
  try {
    // Intentar Windows-1252 primero
    const decoder = new TextDecoder("windows-1252");
    xmlContent = decoder.decode(buffer as ArrayBuffer);
  } catch {
    // Fallback a UTF-8
    const decoder = new TextDecoder("utf-8");
    xmlContent = decoder.decode(buffer as ArrayBuffer);
  }

  // Parsear schema (los tipos de los campos)
  const { tableName, fields } = parseSchema(xmlContent);
  const fieldMap = new Map(fields.map((f) => [f.name, f.type]));

  // Quitar el bloque <xsd:schema> para parsear solo los datos
  const dataXml = xmlContent.replace(/<xsd:schema[\s\S]*?<\/xsd:schema>/, "");

  // Parser XML
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseAttributeValue: false,
    parseTagValue: false, // queremos strings raw para castearlos nosotros
    trimValues: true,
    isArray: (name) => name === tableName,
  });

  let parsed: any;
  try {
    parsed = parser.parse(dataXml);
  } catch (err: any) {
    throw new Error(`Error parseando XML: ${err.message}`);
  }

  // VFPData > tableName[] > {fieldName: value}
  const vfpData = parsed.VFPData;
  if (!vfpData) {
    return {
      tableName,
      fileType: "unknown",
      records: [],
      totalRecords: 0,
      schemaFields: fields,
    };
  }

  const rawRecords = vfpData[tableName];
  if (!rawRecords) {
    return {
      tableName,
      fileType: detectFileType(tableName, fields.map((f) => f.name)),
      records: [],
      totalRecords: 0,
      schemaFields: fields,
    };
  }

  // Convertir cada registro a tipos correctos
  const records: Record<string, any>[] = [];
  const arr = Array.isArray(rawRecords) ? rawRecords : [rawRecords];

  for (const row of arr) {
    const cleaned: Record<string, any> = {};
    for (const [key, rawValue] of Object.entries(row)) {
      const fieldType = fieldMap.get(key) ?? "string";
      cleaned[key] = castValue(rawValue, fieldType);
    }
    records.push(cleaned);
  }

  const fileType = detectFileType(tableName, fields.map((f) => f.name));

  return {
    tableName,
    fileType,
    records,
    totalRecords: records.length,
    schemaFields: fields,
  };
}

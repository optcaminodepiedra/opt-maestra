/**
 * Parser XML para archivos VFPData (SoftRestaurant / Visual FoxPro export).
 *
 * Versión 2: reconoce más tipos de archivos (curtemp ambiguo, chequespagos, etc.)
 */

import { XMLParser } from "fast-xml-parser";

export type ParsedVfpFile = {
  tableName: string;
  fileType: VfpFileType;
  records: Record<string, any>[];
  totalRecords: number;
  schemaFields: Array<{ name: string; type: VfpFieldType }>;
};

export type VfpFileType =
  | "cheques"
  | "cheqdet"
  | "chequespagos"
  | "cancela"
  | "movtoscaja"
  | "turnos"
  | "movsinv"
  | "movtosalmacen"
  | "cuentasporcobrar"
  | "cuentasporcobrarpagos"
  | "compras"
  | "comprasmovtos"
  | "gastos"
  | "gastosmovtos"
  | "facturas"
  | "facturasmovtos"
  | "ordenescompras"
  | "ordenescomprasmov"
  | "hotelmovtos"
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
 * Detecta el tipo de archivo VFP basándose en:
 *  1. El tableName (prefijo "cur") — método principal
 *  2. Si es "curtemp" (genérico), inspecciona los campos
 */
function detectFileType(tableName: string, fieldNames: string[]): VfpFileType {
  const lower = tableName.toLowerCase();

  // ─── Detección directa por tableName ──────────────────────────
  const directMap: Record<string, VfpFileType> = {
    "curcheques": "cheques",
    "curcheqdet": "cheqdet",
    "curchequespagos": "chequespagos",
    "curcancela": "cancela",
    "curmovtoscaja": "movtoscaja",
    "curturnos": "turnos",
    "curmovsinv": "movsinv",
    "curmovtosalmacen": "movtosalmacen",
    "curcuentasporcobrar": "cuentasporcobrar",
    "curcuentasporcobrarpagos": "cuentasporcobrarpagos",
    "curcompras": "compras",
    "curcomprasmovtos": "comprasmovtos",
    "curgastos": "gastos",
    "curgastosmovtos": "gastosmovtos",
    "curfacturas": "facturas",
    "curfacturasmovtos": "facturasmovtos",
    "curordenescompras": "ordenescompras",
    "curordenescomprasmov": "ordenescomprasmov",
    "curhotelmovtos": "hotelmovtos",
    "curbitacoratarjetacredito": "bitacoratarjetacredito",
  };

  if (directMap[lower]) return directMap[lower];

  // ─── curtemp es ambiguo, hay que mirar los campos ────────────
  if (lower === "curtemp") {
    // compras / comprasmovtos
    if (fieldNames.includes("idproveedor") && fieldNames.includes("foliofactura")) return "compras";
    if (fieldNames.includes("idproveedor") && fieldNames.includes("clave") && fieldNames.includes("cantidad")) return "comprasmovtos";

    // gastos / gastosmovtos
    if (fieldNames.includes("idcuentacontable") && fieldNames.includes("descuento")) return "gastos";
    if (fieldNames.includes("idcuentacontable") && fieldNames.includes("foliogasto")) return "gastosmovtos";

    // hotelmovtos
    if (fieldNames.includes("habitacion") && fieldNames.includes("subtotal")) return "hotelmovtos";

    // movsinv
    if (fieldNames.includes("invfisico") && fieldNames.includes("insumo")) return "movsinv";

    // ordenescompras / ordenescomprasmov
    if (fieldNames.includes("foliooc") && fieldNames.includes("idproveedor")) return "ordenescompras";
    if (fieldNames.includes("foliooc") && fieldNames.includes("clave")) return "ordenescomprasmov";

    // movtosalmacen
    if (fieldNames.includes("almacen") && fieldNames.includes("idmovimientoalmacen")) return "movtosalmacen";
  }

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

  const rowMatch = xmlContent.match(
    /<xsd:element\s+name="([a-zA-Z]+)"\s+minOccurs="0"\s+maxOccurs="unbounded">/
  );
  if (rowMatch) tableName = rowMatch[1];

  const elementRegex =
    /<xsd:element\s+name="([a-zA-Z0-9_]+)"(?:\s+type="xsd:([a-zA-Z]+)")?\s*(?:\/>|>(?:[\s\S]*?<xsd:restriction\s+base="xsd:([a-zA-Z]+)")?)/g;

  let match;
  while ((match = elementRegex.exec(xmlContent)) !== null) {
    const fieldName = match[1];
    const directType = match[2];
    const restrictionType = match[3];
    const xsdType = directType || restrictionType;

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
      const dt = new Date(str);
      return isNaN(dt.getTime()) ? null : dt;

    case "date":
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
      }
      return null;

    case "string":
    default:
      return str;
  }
}

/**
 * Parsea un buffer XML VFPData.
 */
export function parseVfpXml(buffer: Buffer | ArrayBuffer): ParsedVfpFile {
  let xmlContent: string;
  try {
    const decoder = new TextDecoder("windows-1252");
    xmlContent = decoder.decode(buffer as ArrayBuffer);
  } catch {
    const decoder = new TextDecoder("utf-8");
    xmlContent = decoder.decode(buffer as ArrayBuffer);
  }

  const { tableName, fields } = parseSchema(xmlContent);
  const fieldMap = new Map(fields.map((f) => [f.name, f.type]));

  const dataXml = xmlContent.replace(/<xsd:schema[\s\S]*?<\/xsd:schema>/, "");

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (name) => name === tableName,
  });

  let parsed: any;
  try {
    parsed = parser.parse(dataXml);
  } catch (err: any) {
    throw new Error(`Error parseando XML: ${err.message}`);
  }

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

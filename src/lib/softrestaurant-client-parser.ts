// src/lib/softrestaurant-client-parser.ts
//
// Parser que corre EN EL CLIENTE (navegador).
// Lee el File / ArrayBuffer y devuelve registros ya parseados como objetos JSON.
// Esto evita enviar el XML crudo (5MB+) al servidor — solo enviamos los objetos
// parseados, que pesan mucho menos.

export function decodeWindows1252(buf: ArrayBuffer): string {
  return new TextDecoder("windows-1252").decode(buf);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Parsea un XML VFPData y devuelve array de records.
 * Mismo algoritmo que el server parser, replicado en cliente.
 */
export function parseVFPRecords(
  xml: string,
  rootName: string
): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const blockRegex = new RegExp(`<${rootName}>([\\s\\S]*?)</${rootName}>`, "g");
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    const record: Record<string, string> = {};
    const fieldRegex = /<(\w+)(?:\s+[^>]*)?>([^<]*)<\/\1>|<(\w+)(?:\s+[^>]*)?\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = fieldRegex.exec(block)) !== null) {
      const name = fm[1] || fm[3];
      const value = fm[2] !== undefined ? fm[2] : "";
      record[name] = decodeXmlEntities(value.trim());
    }
    records.push(record);
  }
  return records;
}

/**
 * Parsea un archivo XML directamente desde File/ArrayBuffer
 */
export async function parseXmlFile<T = Record<string, string>>(
  file: File | ArrayBuffer,
  rootName: string
): Promise<T[]> {
  const buf = file instanceof File ? await file.arrayBuffer() : file;
  const xml = decodeWindows1252(buf);
  return parseVFPRecords(xml, rootName) as T[];
}

/**
 * Convierte un record crudo de cheque en payload JSON compacto.
 * Filtramos solo los campos que realmente usamos para minimizar el payload.
 */
export type ChequeJson = {
  folio: string;
  fecha?: string;
  cierre?: string;
  mesa?: string;
  nopersonas?: string;
  mesero?: string;
  total?: string;
  subtotal?: string;
  descuento?: string;
  propina?: string;
  propinaincluida?: string;
  totalarticulos?: string;
  cancelado?: string;
  razoncancelado?: string;
  numcheque?: string;
  idturno?: string;
  tipodeservicio?: string;
};

export type CheqdetJson = {
  foliodet: string;
  movimiento?: string;
  cantidad?: string;
  claveprod: string;
  precio?: string;
  descuento?: string;
  impuesto?: string;
  preciocatalogo?: string;
  hora?: string;
  modificador?: string;
  idproductocompuesto?: string;
  productocompuestoprincipal?: string;
  comentario?: string;
  estacion?: string;
  idmeseroproducto?: string;
  comanda?: string;
};

export type ChequePagoJson = {
  folio: string;
  idformadepago?: string;
  importe?: string;
  propina?: string;
  tipodecambio?: string;
  referencia?: string;
};

export type CancelaJson = { folio: string };

export type ProductoJson = {
  clave: string;
  descripcion: string;
  grupo?: string;
  precio?: string;
  bloqueado?: string;
};

export type GrupoJson = { clave: string; descripcion: string };

export type MeseroJson = { clave: string; nombre?: string };

export type TurnoJson = {
  idturno: string;
  apertura?: string;
  cierre?: string;
  fondo?: string;
  cajero?: string;
  estacion?: string;
  efectivo?: string;
  tarjeta?: string;
  vales?: string;
  credito?: string;
};

/**
 * Slim down un cheque a sólo lo que necesitamos
 */
export function slimCheque(r: Record<string, string>): ChequeJson | null {
  if (!r.folio) return null;
  return {
    folio: r.folio,
    fecha: r.fecha || undefined,
    cierre: r.cierre || undefined,
    mesa: r.mesa || undefined,
    nopersonas: r.nopersonas || undefined,
    mesero: r.mesero || undefined,
    total: r.total || undefined,
    subtotal: r.subtotal || undefined,
    descuento: r.descuento || undefined,
    propina: r.propina || undefined,
    propinaincluida: r.propinaincluida || undefined,
    totalarticulos: r.totalarticulos || undefined,
    cancelado: r.cancelado || undefined,
    razoncancelado: r.razoncancelado || undefined,
    numcheque: r.numcheque || undefined,
    idturno: r.idturno || undefined,
    tipodeservicio: r.tipodeservicio || undefined,
  };
}

export function slimCheqdet(r: Record<string, string>): CheqdetJson | null {
  if (!r.foliodet || !r.claveprod) return null;
  return {
    foliodet: r.foliodet,
    movimiento: r.movimiento || undefined,
    cantidad: r.cantidad || undefined,
    claveprod: r.claveprod,
    precio: r.precio || undefined,
    descuento: r.descuento || undefined,
    impuesto: r.impuesto || undefined,
    preciocatalogo: r.preciocatalogo || undefined,
    hora: r.hora || undefined,
    modificador: r.modificador || undefined,
    idproductocompuesto: r.idproductocompuesto || undefined,
    productocompuestoprincipal: r.productocompuestoprincipal || undefined,
    comentario: r.comentario || undefined,
    estacion: r.estacion || undefined,
    idmeseroproducto: r.idmeseroproducto || undefined,
    comanda: r.comanda || undefined,
  };
}

export function slimChequePago(r: Record<string, string>): ChequePagoJson | null {
  if (!r.folio) return null;
  return {
    folio: r.folio,
    idformadepago: r.idformadepago || undefined,
    importe: r.importe || undefined,
    propina: r.propina || undefined,
    tipodecambio: r.tipodecambio || undefined,
    referencia: r.referencia || undefined,
  };
}

/**
 * Helper para partir array en chunks
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

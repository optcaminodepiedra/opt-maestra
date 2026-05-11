/**
 * ESC/POS Generator
 *
 * Genera bytes ESC/POS para impresoras térmicas estándar.
 * Compatible con: Epson TM-T20, TM-T88, Holyhah 303L, etc.
 *
 * Documentación de referencia:
 * https://reference.epson-biz.com/modules/ref_escpos/index.php
 */

// ═══════════════════════════════════════════════════════════════
// COMANDOS ESC/POS
// ═══════════════════════════════════════════════════════════════

const ESC = 0x1b;
const GS = 0x1d;

// Tamaños de fuente
const FONT_NORMAL = [ESC, 0x21, 0x00];      // 1x1
const FONT_DOUBLE_HEIGHT = [ESC, 0x21, 0x10]; // doble altura
const FONT_DOUBLE_WIDTH = [ESC, 0x21, 0x20];  // doble ancho
const FONT_DOUBLE = [ESC, 0x21, 0x30];        // doble alto+ancho (título)

// Alineación
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const ALIGN_RIGHT = [ESC, 0x61, 0x02];

// Estilos
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const UNDERLINE_ON = [ESC, 0x2d, 0x01];
const UNDERLINE_OFF = [ESC, 0x2d, 0x00];
const INVERSE_ON = [GS, 0x42, 0x01];
const INVERSE_OFF = [GS, 0x42, 0x00];

// Otros
const INIT = [ESC, 0x40]; // resetea la impresora
const LF = [0x0a];
const CUT_PARTIAL = [GS, 0x56, 0x01];
const CUT_FULL = [GS, 0x56, 0x00];
const BEEP = [ESC, 0x42, 0x05, 0x05]; // beep 5x

// ═══════════════════════════════════════════════════════════════
// HELPER: Builder de comandos
// ═══════════════════════════════════════════════════════════════

class ESCPOSBuilder {
  private bytes: number[] = [];

  constructor() {
    this.bytes.push(...INIT);
  }

  raw(arr: number[]): this {
    this.bytes.push(...arr);
    return this;
  }

  text(s: string): this {
    // Convertir string a bytes con encoding Latin-1 (CP437) para acentos
    // En producción puedes usar iconv-lite, pero esto funciona bien
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code < 128) {
        this.bytes.push(code);
      } else {
        // Mapeo básico para caracteres latinos comunes
        this.bytes.push(this.mapLatinChar(code));
      }
    }
    return this;
  }

  private mapLatinChar(code: number): number {
    // Mapa simple para acentos en CP437/CP850
    const map: Record<number, number> = {
      0xE1: 0xA0, // á
      0xE9: 0x82, // é
      0xED: 0xA1, // í
      0xF3: 0xA2, // ó
      0xFA: 0xA3, // ú
      0xF1: 0xA4, // ñ
      0xC1: 0xB5, // Á
      0xC9: 0x90, // É
      0xCD: 0xD6, // Í
      0xD3: 0xE0, // Ó
      0xDA: 0xE9, // Ú
      0xD1: 0xA5, // Ñ
      0xBF: 0xA8, // ¿
      0xA1: 0xAD, // ¡
      0xB0: 0xF8, // °
    };
    return map[code] ?? 0x3F; // ? si no se conoce
  }

  line(s: string = ""): this {
    return this.text(s).raw(LF);
  }

  feed(n: number = 1): this {
    for (let i = 0; i < n; i++) this.bytes.push(0x0a);
    return this;
  }

  // ─── Alineación ──────────────────────────────────────────────
  alignLeft(): this   { return this.raw(ALIGN_LEFT); }
  alignCenter(): this { return this.raw(ALIGN_CENTER); }
  alignRight(): this  { return this.raw(ALIGN_RIGHT); }

  // ─── Estilos ─────────────────────────────────────────────────
  bold(on: boolean = true): this  { return this.raw(on ? BOLD_ON : BOLD_OFF); }
  underline(on: boolean = true): this { return this.raw(on ? UNDERLINE_ON : UNDERLINE_OFF); }
  inverse(on: boolean = true): this  { return this.raw(on ? INVERSE_ON : INVERSE_OFF); }

  // ─── Tamaños ─────────────────────────────────────────────────
  sizeNormal(): this { return this.raw(FONT_NORMAL); }
  sizeDouble(): this { return this.raw(FONT_DOUBLE); }
  sizeDoubleHeight(): this { return this.raw(FONT_DOUBLE_HEIGHT); }
  sizeDoubleWidth(): this  { return this.raw(FONT_DOUBLE_WIDTH); }

  // ─── Layouts comunes ─────────────────────────────────────────

  /** Línea divisoria con caracter */
  divider(char: string = "-", width: number = 48): this {
    return this.line(char.repeat(width));
  }

  /**
   * Línea de 2 columnas: texto izq + texto der separados
   * Ej: "Total" .......... "$120.00"
   */
  twoColumns(left: string, right: string, width: number = 48): this {
    const space = Math.max(1, width - left.length - right.length);
    return this.line(left + " ".repeat(space) + right);
  }

  /**
   * Línea de 3 columnas: qty x nombre ........ precio
   * Formato típico de ticket
   */
  itemLine(qty: number, name: string, price: string, width: number = 48): this {
    const qtyStr = `${qty}x `;
    const maxNameLen = width - qtyStr.length - price.length - 1;
    let nameTrunc = name;
    if (nameTrunc.length > maxNameLen) {
      nameTrunc = nameTrunc.slice(0, maxNameLen - 1) + "…";
    }
    const space = width - qtyStr.length - nameTrunc.length - price.length;
    return this.line(qtyStr + nameTrunc + " ".repeat(Math.max(1, space)) + price);
  }

  // ─── QR Code ─────────────────────────────────────────────────

  /**
   * Imprime QR (modelo 2). Tamaño 1-16. Texto.
   */
  qrCode(text: string, size: number = 6): this {
    const data = Buffer.from(text, "utf-8");
    const len = data.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;

    // Modelo QR
    this.bytes.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Tamaño
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // Nivel error
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // Store data
    this.bytes.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    for (const b of data) this.bytes.push(b);
    // Print
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    return this;
  }

  // ─── Corte ───────────────────────────────────────────────────
  cut(partial: boolean = true): this {
    this.feed(3);
    return this.raw(partial ? CUT_PARTIAL : CUT_FULL);
  }

  beep(): this {
    return this.raw(BEEP);
  }

  // ─── Output ──────────────────────────────────────────────────

  toBuffer(): Buffer {
    return Buffer.from(this.bytes);
  }

  toBase64(): string {
    return Buffer.from(this.bytes).toString("base64");
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERADORES DE TICKETS
// ═══════════════════════════════════════════════════════════════

export type ReceiptData = {
  // Negocio
  businessName: string;
  tagline?: string;
  phone?: string;
  address?: string;
  website?: string;
  footer?: string;

  // Venta
  saleId: string;
  ticketNumber: string; // ej "0042"
  date: Date;
  mesero: string;
  tableName: string;

  items: Array<{
    qty: number;
    name: string;
    note?: string | null;
    priceCents: number;
    subtotalCents: number;
  }>;

  subtotalCents: number;
  tipCents?: number;
  totalCents: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";

  qrUrl?: string; // QR al final del ticket
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const PAYMENT_LABELS = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Otro",
};

/**
 * Genera el ticket de cliente (caja).
 * Incluye logo, items, totales, propinas sugeridas, QR.
 */
export function buildCustomerReceipt(data: ReceiptData): Buffer {
  const b = new ESCPOSBuilder();
  const W = 48; // 80mm = 48 chars

  // ─── Encabezado ──────────────────────────────────────────────
  b.alignCenter()
   .bold(true).sizeDouble().line(data.businessName).sizeNormal().bold(false);

  if (data.tagline) {
    b.line(data.tagline);
  }

  if (data.address) b.line(data.address);
  if (data.phone)   b.line(`Tel: ${data.phone}`);
  if (data.website) b.line(data.website);

  b.feed(1).divider("=", W);

  // ─── Info del ticket ─────────────────────────────────────────
  b.alignLeft()
   .twoColumns("Ticket:", `#${data.ticketNumber}`, W)
   .twoColumns("Fecha:", fmtDate(data.date), W)
   .twoColumns("Mesa:", data.tableName, W)
   .twoColumns("Atendió:", data.mesero, W);

  b.divider("-", W);

  // ─── Items ───────────────────────────────────────────────────
  b.bold(true).twoColumns("Producto", "Importe", W).bold(false);
  b.divider("-", W);

  for (const item of data.items) {
    b.itemLine(item.qty, item.name, fmt(item.subtotalCents), W);
    if (item.note) {
      b.line(`   * ${item.note}`);
    }
  }

  b.divider("-", W);

  // ─── Totales ─────────────────────────────────────────────────
  b.twoColumns("Subtotal:", fmt(data.subtotalCents), W);

  if (data.tipCents && data.tipCents > 0) {
    b.twoColumns("Propina:", fmt(data.tipCents), W);
  }

  b.bold(true).sizeDoubleHeight()
   .twoColumns("TOTAL:", fmt(data.totalCents), W / 2 + 5) // ajuste por doble altura
   .sizeNormal().bold(false);

  b.feed(1)
   .twoColumns("Pago:", PAYMENT_LABELS[data.paymentMethod], W);

  // ─── Propinas sugeridas (si no se cobró propina) ─────────────
  if (!data.tipCents || data.tipCents === 0) {
    b.feed(1).divider("-", W);
    b.alignCenter().bold(true).line("Propina sugerida").bold(false);
    b.alignLeft();
    const subtotal = data.subtotalCents;
    b.twoColumns("  10%:", fmt(Math.round(subtotal * 0.10)), W)
     .twoColumns("  15%:", fmt(Math.round(subtotal * 0.15)), W)
     .twoColumns("  20%:", fmt(Math.round(subtotal * 0.20)), W);
  }

  b.feed(1).divider("=", W);

  // ─── QR + Footer ─────────────────────────────────────────────
  b.alignCenter();

  if (data.qrUrl) {
    b.line("Visítanos en línea").feed(1)
     .qrCode(data.qrUrl, 6).feed(1)
     .line(data.qrUrl).feed(1);
  }

  if (data.footer) {
    b.bold(true).line(data.footer).bold(false);
  }
  b.line("¡Te esperamos pronto!").feed(2);

  // Corte
  b.cut(true);

  return b.toBuffer();
}

// ═══════════════════════════════════════════════════════════════
// COMANDA DE COCINA / BARRA
// ═══════════════════════════════════════════════════════════════

export type KitchenTicketData = {
  station: "KITCHEN" | "BAR";
  businessName: string;
  tableName: string;
  tableArea?: string | null;
  mesero: string;
  orderId: string;
  orderShort: string; // últimos 6 chars
  timestamp: Date;
  orderNote?: string | null;

  items: Array<{
    qty: number;
    name: string;
    note?: string | null;
  }>;
};

const STATION_LABELS = {
  KITCHEN: "COCINA",
  BAR: "BARRA",
};

/**
 * Comanda para cocina o barra: items grandes y legibles.
 * Sin precios, formato simple y rápido.
 */
export function buildKitchenTicket(data: KitchenTicketData): Buffer {
  const b = new ESCPOSBuilder();
  const W = 48;

  // ─── Encabezado: BARRA o COCINA en grande ────────────────────
  b.alignCenter().bold(true).sizeDouble()
   .line(STATION_LABELS[data.station])
   .sizeNormal().bold(false);

  b.divider("=", W);

  // ─── Mesa + orden info ───────────────────────────────────────
  b.alignLeft().bold(true).sizeDoubleHeight()
   .line(`MESA: ${data.tableName}`)
   .sizeNormal().bold(false);

  if (data.tableArea) b.line(`Área: ${data.tableArea}`);
  b.line(`Mesero: ${data.mesero}`);
  b.line(`Orden: #${data.orderShort}`);
  b.line(`Hora:  ${fmtDate(data.timestamp)}`);

  if (data.orderNote) {
    b.feed(1).bold(true).line(`NOTA: ${data.orderNote}`).bold(false);
  }

  b.divider("-", W);

  // ─── Items ───────────────────────────────────────────────────
  b.sizeDoubleHeight();
  for (const item of data.items) {
    b.bold(true).line(`${item.qty}x ${item.name}`).bold(false);
    if (item.note) {
      b.sizeNormal().line(`   >> ${item.note}`).sizeDoubleHeight();
    }
  }
  b.sizeNormal();

  b.divider("=", W).feed(2);
  b.cut(true);

  return b.toBuffer();
}

// ═══════════════════════════════════════════════════════════════
// Exportar también el builder por si necesitas custom
// ═══════════════════════════════════════════════════════════════

export { ESCPOSBuilder };

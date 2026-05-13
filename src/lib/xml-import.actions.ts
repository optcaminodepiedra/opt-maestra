"use server";

import { prisma } from "@/lib/prisma";
import { getMe } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { parseVfpXml, type ParsedVfpFile, type VfpFileType } from "@/lib/xml-parser";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const EXTERNAL_SOURCE = "softrestaurant";

async function assertAdmin() {
  const me = await getMe();
  if (!ADMIN_ROLES.includes(me.role as string)) {
    throw new Error("Solo administradores pueden importar.");
  }
  return me;
}

export type XmlImportSummary = {
  filename: string;
  fileType: VfpFileType;
  totalRecords: number;
  imported: number;
  skipped: number;     // duplicados detectados
  errors: number;
  errorDetails: Array<{ row: number; message: string }>;
};

export type XmlImportRequest = {
  filename: string;
  base64Content: string;  // contenido del XML en base64
};

export type XmlImportResult = {
  batchId: string;
  businessId: string;
  totalFiles: number;
  summaries: XmlImportSummary[];
  totals: {
    totalRecords: number;
    imported: number;
    skipped: number;
    errors: number;
  };
};


// ═══════════════════════════════════════════════════════════════
// ENTRADA PRINCIPAL: runXmlImport
// ═══════════════════════════════════════════════════════════════

/**
 * Procesa varios archivos XML de SoftRestaurant.
 * Detecta automáticamente el tipo de cada archivo y los dispatcha
 * a los importadores correctos.
 *
 * Idempotente: si el folio ya existe, se salta.
 */
export async function runXmlImport(
  businessId: string,
  files: XmlImportRequest[]
): Promise<XmlImportResult> {
  const me = await assertAdmin();

  // Validar businessId
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) throw new Error("Negocio no encontrado");

  // Parsear todos los archivos antes de tocar BD
  const parsedFiles: Array<{ filename: string; parsed: ParsedVfpFile }> = [];
  for (const file of files) {
    try {
      const buffer = Buffer.from(file.base64Content, "base64");
      const parsed = parseVfpXml(buffer);
      parsedFiles.push({ filename: file.filename, parsed });
    } catch (err: any) {
      parsedFiles.push({
        filename: file.filename,
        parsed: {
          tableName: "error",
          fileType: "unknown",
          records: [],
          totalRecords: 0,
          schemaFields: [],
        },
      });
    }
  }

  // Calcular total de registros para el batch
  const totalRecords = parsedFiles.reduce((s, f) => s + f.parsed.totalRecords, 0);

  // Crear batch maestro
  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES", // genérico - el batch puede contener varios tipos
      businessId,
      filename: files.map((f) => f.filename).join(", "),
      totalRows: totalRecords,
      status: "PROCESSING",
      createdById: (me as any).id,
    },
  });

  // Cargar cheques.xml primero porque cheqdet.xml depende de él
  // Orden: cheques → cheqdet → movtoscaja → turnos → cancela → otros
  const order: VfpFileType[] = [
    "cheques",
    "cheqdet",
    "movtoscaja",
    "turnos",
    "cancela",
    "cuentasporcobrar",
    "movsinv",
    "compras",
    "gastos",
    "hotelmovtos",
  ];

  const sortedFiles = [...parsedFiles].sort((a, b) => {
    const ai = order.indexOf(a.parsed.fileType);
    const bi = order.indexOf(b.parsed.fileType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const summaries: XmlImportSummary[] = [];

  // Cache de cheques importados (folio → saleId) para que cheqdet pueda referenciarlos
  const folioToSaleId = new Map<string, string>();

  // Para los meseros del XML, intentamos mapear si encontramos un User con username similar
  const usersCache = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, username: true, fullName: true },
  });

  // Cashpoint para usar como fallback
  let firstCashpoint = await prisma.cashpoint.findFirst({
    where: { businessId },
    select: { id: true },
  });
  if (!firstCashpoint) {
    // Crear uno si no existe (Bodega 4 ya debería tener pero por seguridad)
    firstCashpoint = await prisma.cashpoint.create({
      data: { businessId, name: "Caja Principal" },
      select: { id: true },
    });
  }

  const fallbackUserId = (me as any).id as string;

  for (const { filename, parsed } of sortedFiles) {
    let summary: XmlImportSummary;
    try {
      switch (parsed.fileType) {
        case "cheques":
          summary = await importCheques(
            batch.id, businessId, filename, parsed,
            firstCashpoint.id, fallbackUserId, usersCache, folioToSaleId
          );
          break;
        case "movtoscaja":
          summary = await importMovtosCaja(
            batch.id, businessId, filename, parsed, fallbackUserId
          );
          break;
        case "cheqdet":
        case "turnos":
        case "cancela":
        case "movsinv":
        case "cuentasporcobrar":
          // Por ahora estos no se importan a tablas específicas
          // pero los contamos como "informativos" en el reporte
          summary = {
            filename, fileType: parsed.fileType,
            totalRecords: parsed.totalRecords,
            imported: 0, skipped: 0, errors: 0,
            errorDetails: [{
              row: 0,
              message: `Archivo "${parsed.fileType}" reconocido pero no importable directamente. Datos disponibles: ${parsed.totalRecords} registros.`
            }],
          };
          break;
        default:
          summary = {
            filename, fileType: parsed.fileType,
            totalRecords: parsed.totalRecords,
            imported: 0, skipped: 0, errors: parsed.totalRecords,
            errorDetails: [{ row: 0, message: `Tipo de archivo no reconocido (${parsed.tableName})` }],
          };
      }
    } catch (err: any) {
      summary = {
        filename, fileType: parsed.fileType,
        totalRecords: parsed.totalRecords,
        imported: 0, skipped: 0, errors: parsed.totalRecords,
        errorDetails: [{ row: 0, message: `Error general: ${err.message}` }],
      };
    }
    summaries.push(summary);
  }

  const totals = {
    totalRecords: summaries.reduce((s, x) => s + x.totalRecords, 0),
    imported: summaries.reduce((s, x) => s + x.imported, 0),
    skipped: summaries.reduce((s, x) => s + x.skipped, 0),
    errors: summaries.reduce((s, x) => s + x.errors, 0),
  };

  // Finalizar batch
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: totals.errors === totals.totalRecords ? "FAILED" : "COMPLETED",
      successRows: totals.imported,
      errorRows: totals.errors,
      errors: summaries as any,
      completedAt: new Date(),
    },
  });

  revalidatePath("/app/admin/import");
  return {
    batchId: batch.id,
    businessId,
    totalFiles: files.length,
    summaries,
    totals,
  };
}


// ═══════════════════════════════════════════════════════════════
// IMPORTAR cheques.xml → Sale
// ═══════════════════════════════════════════════════════════════

async function importCheques(
  batchId: string,
  businessId: string,
  filename: string,
  parsed: ParsedVfpFile,
  cashpointId: string,
  fallbackUserId: string,
  users: Array<{ id: string; username: string; fullName: string }>,
  folioToSaleId: Map<string, string>
): Promise<XmlImportSummary> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: Array<{ row: number; message: string }> = [];

  // Cargar folios ya importados para este business (idempotencia rápida)
  const existing = await prisma.sale.findMany({
    where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    select: { id: true, externalFolio: true } as any,
  });
  const existingFolios = new Map<string, string>();
  for (const s of existing as any[]) {
    if (s.externalFolio) existingFolios.set(s.externalFolio, s.id);
  }

  for (let i = 0; i < parsed.records.length; i++) {
    const row = parsed.records[i];
    const rowNum = i + 1;

    try {
      const folio = row.folio != null ? String(row.folio) : null;
      if (!folio) {
        errors++;
        errorDetails.push({ row: rowNum, message: "Sin folio, se salta" });
        continue;
      }

      // Idempotencia: si ya existe, saltar
      if (existingFolios.has(folio)) {
        skipped++;
        folioToSaleId.set(folio, existingFolios.get(folio)!);
        continue;
      }

      // Saltar cancelados (mantener trazabilidad como nota pero no como venta válida)
      const cancelado = row.cancelado === true;
      const pagado = row.pagado === true;
      if (cancelado) {
        skipped++;
        continue;
      }
      if (!pagado) {
        skipped++;
        continue;
      }

      // Fecha
      const fecha: Date = row.cierre ?? row.fecha;
      if (!fecha || !(fecha instanceof Date) || isNaN(fecha.getTime())) {
        errors++;
        errorDetails.push({ row: rowNum, message: "Fecha inválida" });
        continue;
      }

      // Total
      const totalConPropina = row.totalconpropina ?? row.total ?? 0;
      if (totalConPropina <= 0) {
        skipped++;
        continue;
      }
      const amountCents = Math.round(totalConPropina * 100);

      // Método de pago dominante
      const efectivo = row.efectivo ?? 0;
      const tarjeta = row.tarjeta ?? 0;
      const otros = row.otros ?? 0;
      const vales = row.vales ?? 0;

      let method: "CASH" | "CARD" | "TRANSFER" = "CASH";
      const max = Math.max(efectivo, tarjeta, otros, vales);
      if (max === tarjeta && tarjeta > 0) method = "CARD";
      else if ((max === otros || max === vales) && (otros > 0 || vales > 0)) method = "TRANSFER";

      // Concepto: mesa, no personas, mesero
      const mesa = row.mesa ?? "?";
      const nopersonas = row.nopersonas ?? 1;
      const meseroNum = row.mesero ?? "?";
      const concept = `Mesa ${mesa} · ${nopersonas} pax · Mesero ${meseroNum}`;

      // Intentar mapear mesero (es número, pero quizá user tenga username similar)
      // Por ahora dejamos fallbackUserId
      const userId = fallbackUserId;

      const sale = await prisma.sale.create({
        data: {
          businessId,
          cashpointId,
          userId,
          amountCents,
          method,
          concept,
          createdAt: fecha,
          importBatchId: batchId,
          externalSource: EXTERNAL_SOURCE,
          externalFolio: folio,
        } as any,
      });

      folioToSaleId.set(folio, sale.id);
      existingFolios.set(folio, sale.id);
      imported++;
    } catch (err: any) {
      errors++;
      errorDetails.push({
        row: rowNum,
        message: err.message?.slice(0, 200) ?? "Error desconocido",
      });
    }
  }

  return {
    filename,
    fileType: "cheques",
    totalRecords: parsed.records.length,
    imported,
    skipped,
    errors,
    errorDetails: errorDetails.slice(0, 50),
  };
}


// ═══════════════════════════════════════════════════════════════
// IMPORTAR movtoscaja.xml → Expense
// ═══════════════════════════════════════════════════════════════

async function importMovtosCaja(
  batchId: string,
  businessId: string,
  filename: string,
  parsed: ParsedVfpFile,
  fallbackUserId: string
): Promise<XmlImportSummary> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: Array<{ row: number; message: string }> = [];

  // Idempotencia
  const existing = await prisma.expense.findMany({
    where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    select: { externalFolio: true } as any,
  });
  const existingFolios = new Set((existing as any[]).map((e) => e.externalFolio).filter(Boolean));

  for (let i = 0; i < parsed.records.length; i++) {
    const row = parsed.records[i];
    const rowNum = i + 1;

    try {
      const folio = row.folio != null ? String(row.folio) : null;
      if (!folio) {
        errors++;
        errorDetails.push({ row: rowNum, message: "Sin folio" });
        continue;
      }

      if (existingFolios.has(folio)) {
        skipped++;
        continue;
      }

      // Saltar cancelados
      if (row.cancelado === true) {
        skipped++;
        continue;
      }

      const importe = row.importe ?? 0;
      if (importe <= 0) {
        skipped++;
        continue;
      }

      const fecha: Date = row.fecha;
      if (!fecha || !(fecha instanceof Date)) {
        errors++;
        errorDetails.push({ row: rowNum, message: "Fecha inválida" });
        continue;
      }

      const conceptoRaw = String(row.concepto ?? "").trim();
      const referencia = String(row.referencia ?? "").trim();

      // Categorizar: PROPINA si menciona propina, NÓMINAS si menciona nómina, OTROS
      const conceptoUpper = conceptoRaw.toUpperCase();
      let category = "Otros";
      if (conceptoUpper.includes("PROPINA")) category = "Propina pagada";
      else if (conceptoUpper.includes("NOMINA") || conceptoUpper.includes("NÓMINA")) category = "Nóminas";
      else if (conceptoUpper.includes("PAN") || conceptoUpper.includes("BOLILLO") || conceptoUpper.includes("BROTE")) {
        category = "Insumos del día";
      }

      const note = referencia ? `${conceptoRaw} (Ref: ${referencia})` : conceptoRaw;
      const amountCents = Math.round(importe * 100);

      await prisma.expense.create({
        data: {
          businessId,
          userId: fallbackUserId,
          amountCents,
          category,
          note: note || null,
          createdAt: fecha,
          importBatchId: batchId,
          externalSource: EXTERNAL_SOURCE,
          externalFolio: folio,
        } as any,
      });

      existingFolios.add(folio);
      imported++;
    } catch (err: any) {
      errors++;
      errorDetails.push({
        row: rowNum,
        message: err.message?.slice(0, 200) ?? "Error desconocido",
      });
    }
  }

  return {
    filename,
    fileType: "movtoscaja",
    totalRecords: parsed.records.length,
    imported,
    skipped,
    errors,
    errorDetails: errorDetails.slice(0, 50),
  };
}

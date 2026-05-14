import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseVfpXml, type ParsedVfpFile, type VfpFileType } from "@/lib/xml-parser";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const EXTERNAL_SOURCE = "softrestaurant";
const STORAGE_BUCKET = "xml-imports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const BATCH_SIZE = 500;

type ImportSummary = {
  filename: string;
  fileType: VfpFileType;
  totalRecords: number;
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ row: number; message: string }>;
};

type ImportResult = {
  batchId: string;
  businessId: string;
  totalFiles: number;
  summaries: ImportSummary[];
  totals: {
    totalRecords: number;
    imported: number;
    skipped: number;
    errors: number;
  };
};

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log("[upload-xml] === POST INICIO ===");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Solo administradores pueden importar" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;

  let body: any;
  try {
    body = await req.json();
  } catch (err: any) {
    return NextResponse.json({ error: `Body JSON inválido: ${err.message}` }, { status: 400 });
  }

  const businessId: string = body.businessId;
  const fileRefs: Array<{ filename: string; storagePath: string }> = body.files;

  if (!businessId) {
    return NextResponse.json({ error: "Falta businessId" }, { status: 400 });
  }
  if (!Array.isArray(fileRefs) || fileRefs.length === 0) {
    return NextResponse.json({ error: "Falta files (array)" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  console.log(`[upload-xml] Procesando ${fileRefs.length} archivos para ${business.name}`);

  try {
    const result = await processFiles(businessId, userId, fileRefs);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[upload-xml] === COMPLETADO en ${dt}s ===`);
    return NextResponse.json(result);
  } catch (err: any) {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`[upload-xml] ERROR en ${dt}s:`, err);
    return NextResponse.json({ error: err.message ?? "Error procesando archivos" }, { status: 500 });
  }
}

async function processFiles(
  businessId: string,
  userId: string,
  fileRefs: Array<{ filename: string; storagePath: string }>
): Promise<ImportResult> {
  const supabase = getSupabaseAdmin();

  const parsedFiles: Array<{ filename: string; storagePath: string; parsed: ParsedVfpFile }> = [];

  for (const ref of fileRefs) {
    const t = Date.now();
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(ref.storagePath);

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo descargar");
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = parseVfpXml(buffer);

      parsedFiles.push({ filename: ref.filename, storagePath: ref.storagePath, parsed });
      console.log(`[upload-xml] Parseado ${ref.filename} (${parsed.fileType}, ${parsed.totalRecords} regs) en ${Date.now() - t}ms`);
    } catch (err: any) {
      console.error(`[upload-xml] Error con ${ref.filename}:`, err.message);
      parsedFiles.push({
        filename: ref.filename,
        storagePath: ref.storagePath,
        parsed: { tableName: "error", fileType: "unknown", records: [], totalRecords: 0, schemaFields: [] },
      });
    }
  }

  const totalRecords = parsedFiles.reduce((s, f) => s + f.parsed.totalRecords, 0);

  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES",
      businessId,
      filename: fileRefs.map((f) => f.filename).join(", ").slice(0, 500),
      totalRows: totalRecords,
      status: "PROCESSING",
      createdById: userId,
    },
  });

  const order: VfpFileType[] = [
    "cheques", "cheqdet", "chequespagos", "movtoscaja", "turnos", "cancela",
    "cuentasporcobrar", "cuentasporcobrarpagos", "movsinv", "movtosalmacen",
    "compras", "comprasmovtos", "gastos", "gastosmovtos",
    "facturas", "facturasmovtos", "ordenescompras", "ordenescomprasmov",
    "hotelmovtos", "bitacoratarjetacredito",
  ];

  const sortedFiles = [...parsedFiles].sort((a, b) => {
    const ai = order.indexOf(a.parsed.fileType);
    const bi = order.indexOf(b.parsed.fileType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  let firstCashpoint = await prisma.cashpoint.findFirst({
    where: { businessId },
    select: { id: true },
  });
  if (!firstCashpoint) {
    firstCashpoint = await prisma.cashpoint.create({
      data: { businessId, name: "Caja Principal" },
      select: { id: true },
    });
  }

  const summaries: ImportSummary[] = [];

  for (const { filename, parsed } of sortedFiles) {
    const t = Date.now();
    let summary: ImportSummary;
    try {
      switch (parsed.fileType) {
        case "cheques":
          summary = await importChequesFast(batch.id, businessId, filename, parsed, firstCashpoint.id, userId);
          break;
        case "movtoscaja":
          summary = await importMovtosCajaFast(batch.id, businessId, filename, parsed, userId);
          break;
        default:
          summary = {
            filename, fileType: parsed.fileType,
            totalRecords: parsed.totalRecords,
            imported: 0, skipped: 0, errors: 0,
            errorDetails: [{
              row: 0,
              message: parsed.fileType === "unknown"
                ? `Tipo no reconocido (${parsed.tableName})`
                : `Tipo "${parsed.fileType}" reconocido — ${parsed.totalRecords} registros disponibles pero no se importan a tablas específicas en esta versión.`,
            }],
          };
      }
      console.log(`[upload-xml] Importado ${filename}: ${summary.imported} ok, ${summary.skipped} skip, ${summary.errors} err (${Date.now() - t}ms)`);
    } catch (err: any) {
      console.error(`[upload-xml] Falló ${filename}:`, err.message);
      summary = {
        filename, fileType: parsed.fileType,
        totalRecords: parsed.totalRecords,
        imported: 0, skipped: 0, errors: parsed.totalRecords,
        errorDetails: [{ row: 0, message: `Error: ${err.message}` }],
      };
    }
    summaries.push(summary);
  }

  // Cleanup: borrar archivos del bucket
  for (const f of parsedFiles) {
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([f.storagePath]);
    } catch {}
  }

  const totals = {
    totalRecords: summaries.reduce((s, x) => s + x.totalRecords, 0),
    imported: summaries.reduce((s, x) => s + x.imported, 0),
    skipped: summaries.reduce((s, x) => s + x.skipped, 0),
    errors: summaries.reduce((s, x) => s + x.errors, 0),
  };

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

  return {
    batchId: batch.id,
    businessId,
    totalFiles: fileRefs.length,
    summaries,
    totals,
  };
}

// ═══════════════════════════════════════════════════════════════
// IMPORTADOR CHEQUES — FIX del contador
// ═══════════════════════════════════════════════════════════════
// Antes: usaba result.count de createMany() que es BUGGY con
//        skipDuplicates en algunas versiones de Prisma → devuelve 0
//
// Ahora: cuenta ANTES y DESPUÉS con findMany() y compara
//        la diferencia es el número real de inserciones
// ═══════════════════════════════════════════════════════════════

async function importChequesFast(
  batchId: string,
  businessId: string,
  filename: string,
  parsed: ParsedVfpFile,
  cashpointId: string,
  fallbackUserId: string
): Promise<ImportSummary> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: Array<{ row: number; message: string }> = [];

  // Cargar folios existentes
  const existing = await prisma.sale.findMany({
    where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    select: { externalFolio: true } as any,
  });
  const existingFolios = new Set(
    (existing as any[]).map((s) => s.externalFolio).filter(Boolean)
  );

  const toInsert: any[] = [];

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

      if (row.cancelado === true) {
        skipped++;
        continue;
      }
      if (row.pagado !== true) {
        skipped++;
        continue;
      }

      const fecha: Date = row.cierre ?? row.fecha;
      if (!fecha || !(fecha instanceof Date) || isNaN(fecha.getTime())) {
        errors++;
        errorDetails.push({ row: rowNum, message: "Fecha inválida" });
        continue;
      }

      const totalConPropina = row.totalconpropina ?? row.total ?? 0;
      if (totalConPropina <= 0) {
        skipped++;
        continue;
      }
      const amountCents = Math.round(totalConPropina * 100);

      const efectivo = row.efectivo ?? 0;
      const tarjeta = row.tarjeta ?? 0;
      const otros = row.otros ?? 0;
      const vales = row.vales ?? 0;

      let method: "CASH" | "CARD" | "TRANSFER" = "CASH";
      const max = Math.max(efectivo, tarjeta, otros, vales);
      if (max === tarjeta && tarjeta > 0) method = "CARD";
      else if ((max === otros || max === vales) && (otros > 0 || vales > 0)) method = "TRANSFER";

      const mesa = row.mesa ?? "?";
      const nopersonas = row.nopersonas ?? 1;
      const meseroNum = row.mesero ?? "?";
      const concept = `Mesa ${mesa} · ${nopersonas} pax · Mesero ${meseroNum}`;

      toInsert.push({
        businessId,
        cashpointId,
        userId: fallbackUserId,
        amountCents,
        method,
        concept,
        createdAt: fecha,
        importBatchId: batchId,
        externalSource: EXTERNAL_SOURCE,
        externalFolio: folio,
      });

      existingFolios.add(folio);
    } catch (err: any) {
      errors++;
      errorDetails.push({ row: rowNum, message: err.message?.slice(0, 200) ?? "Error" });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FIX DEL CONTADOR: medir antes y después con count()
  // ═══════════════════════════════════════════════════════════════
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);

    // 1. Contar ANTES del insert
    const countBefore = await prisma.sale.count({
      where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    });

    try {
      await prisma.sale.createMany({
        data: chunk as any,
        skipDuplicates: true,
      });

      // 2. Contar DESPUÉS del insert
      const countAfter = await prisma.sale.count({
        where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
      });

      const insertedInThisBatch = countAfter - countBefore;
      imported += insertedInThisBatch;

      console.log(
        `[upload-xml] Batch ${i / BATCH_SIZE + 1}: ` +
        `intentamos ${chunk.length}, insertados ${insertedInThisBatch}, ` +
        `count before=${countBefore} after=${countAfter}`
      );
    } catch (err: any) {
      console.error(`[upload-xml] Batch falló, reintentando uno por uno:`, err.message);
      for (const item of chunk) {
        try {
          await prisma.sale.create({ data: item });
          imported++;
        } catch (e: any) {
          errors++;
          errorDetails.push({
            row: 0,
            message: `Folio ${item.externalFolio}: ${e.message?.slice(0, 100)}`,
          });
        }
      }
    }
  }

  return {
    filename, fileType: "cheques",
    totalRecords: parsed.records.length,
    imported, skipped, errors,
    errorDetails: errorDetails.slice(0, 50),
  };
}

// ═══════════════════════════════════════════════════════════════
// IMPORTADOR MOVIMIENTOS CAJA — mismo fix del contador
// ═══════════════════════════════════════════════════════════════

async function importMovtosCajaFast(
  batchId: string,
  businessId: string,
  filename: string,
  parsed: ParsedVfpFile,
  fallbackUserId: string
): Promise<ImportSummary> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: Array<{ row: number; message: string }> = [];

  const existing = await prisma.expense.findMany({
    where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    select: { externalFolio: true } as any,
  });
  const existingFolios = new Set(
    (existing as any[]).map((e) => e.externalFolio).filter(Boolean)
  );

  const toInsert: any[] = [];

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
      const conceptoUpper = conceptoRaw.toUpperCase();

      let category = "Otros";
      if (conceptoUpper.includes("PROPINA")) category = "Propina pagada";
      else if (conceptoUpper.includes("NOMINA") || conceptoUpper.includes("NÓMINA")) category = "Nóminas";
      else if (
        conceptoUpper.includes("PAN") ||
        conceptoUpper.includes("BOLILLO") ||
        conceptoUpper.includes("BROTE")
      ) {
        category = "Insumos del día";
      }

      const note = referencia ? `${conceptoRaw} (Ref: ${referencia})` : conceptoRaw;
      const amountCents = Math.round(importe * 100);

      toInsert.push({
        businessId,
        userId: fallbackUserId,
        amountCents,
        category,
        note: note || null,
        createdAt: fecha,
        importBatchId: batchId,
        externalSource: EXTERNAL_SOURCE,
        externalFolio: folio,
      });

      existingFolios.add(folio);
    } catch (err: any) {
      errors++;
      errorDetails.push({ row: rowNum, message: err.message?.slice(0, 200) ?? "Error" });
    }
  }

  // FIX DEL CONTADOR: count() antes/después
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);

    const countBefore = await prisma.expense.count({
      where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
    });

    try {
      await prisma.expense.createMany({
        data: chunk as any,
        skipDuplicates: true,
      });

      const countAfter = await prisma.expense.count({
        where: { businessId, externalSource: EXTERNAL_SOURCE } as any,
      });

      imported += (countAfter - countBefore);
    } catch (err: any) {
      console.error(`[upload-xml] Batch Expense falló:`, err.message);
      for (const item of chunk) {
        try {
          await prisma.expense.create({ data: item });
          imported++;
        } catch (e: any) {
          errors++;
          errorDetails.push({
            row: 0,
            message: `Folio ${item.externalFolio}: ${e.message?.slice(0, 100)}`,
          });
        }
      }
    }
  }

  return {
    filename, fileType: "movtoscaja",
    totalRecords: parsed.records.length,
    imported, skipped, errors,
    errorDetails: errorDetails.slice(0, 50),
  };
}

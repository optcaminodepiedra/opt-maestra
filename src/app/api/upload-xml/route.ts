import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseVfpXml, type ParsedVfpFile, type VfpFileType } from "@/lib/xml-parser";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];
const EXTERNAL_SOURCE = "softrestaurant";

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════
// Los route handlers de Next.js NO tienen el límite de 4.5MB de
// Server Actions. Pueden recibir requests grandes vía multipart.
// maxDuration alto porque parsear 9MB de XML toma varios segundos.
// ═══════════════════════════════════════════════════════════════
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 segundos (límite Vercel Free)
export const runtime = "nodejs";

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
  // ─── 1. Autenticación ─────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Solo administradores pueden importar" }, { status: 403 });
  }

  const userId = (session.user as any).id as string;

  // ─── 2. Parsear multipart/form-data ──────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error parseando formData: ${err.message}` },
      { status: 400 }
    );
  }

  const businessId = formData.get("businessId") as string | null;
  if (!businessId) {
    return NextResponse.json({ error: "Falta businessId" }, { status: 400 });
  }

  // ─── 3. Validar negocio ──────────────────────────────────────
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  // ─── 4. Obtener archivos del FormData ────────────────────────
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("file") && value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No se enviaron archivos" }, { status: 400 });
  }

  // ─── 5. Procesar archivos ────────────────────────────────────
  try {
    const result = await processFiles(businessId, userId, files);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[upload-xml] ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "Error procesando archivos" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PROCESAMIENTO DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════

async function processFiles(
  businessId: string,
  userId: string,
  files: File[]
): Promise<ImportResult> {
  // Parsear todos primero
  const parsedFiles: Array<{ filename: string; parsed: ParsedVfpFile }> = [];
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = parseVfpXml(buffer);
      parsedFiles.push({ filename: file.name, parsed });
    } catch (err: any) {
      parsedFiles.push({
        filename: file.name,
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

  const totalRecords = parsedFiles.reduce((s, f) => s + f.parsed.totalRecords, 0);

  // Crear batch maestro
  const batch = await prisma.importBatch.create({
    data: {
      entityType: "SALES",
      businessId,
      filename: files.map((f) => f.name).join(", ").slice(0, 500),
      totalRows: totalRecords,
      status: "PROCESSING",
      createdById: userId,
    },
  });

  // Orden: cheques primero
  const order: VfpFileType[] = [
    "cheques", "cheqdet", "movtoscaja", "turnos", "cancela",
    "cuentasporcobrar", "movsinv", "compras", "gastos", "hotelmovtos",
  ];

  const sortedFiles = [...parsedFiles].sort((a, b) => {
    const ai = order.indexOf(a.parsed.fileType);
    const bi = order.indexOf(b.parsed.fileType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const summaries: ImportSummary[] = [];

  // Cashpoint fallback
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

  for (const { filename, parsed } of sortedFiles) {
    let summary: ImportSummary;
    try {
      switch (parsed.fileType) {
        case "cheques":
          summary = await importCheques(
            batch.id, businessId, filename, parsed,
            firstCashpoint.id, userId
          );
          break;
        case "movtoscaja":
          summary = await importMovtosCaja(
            batch.id, businessId, filename, parsed, userId
          );
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
                : `${parsed.totalRecords} registros disponibles pero no se importan en esta versión.`,
            }],
          };
      }
    } catch (err: any) {
      summary = {
        filename, fileType: parsed.fileType,
        totalRecords: parsed.totalRecords,
        imported: 0, skipped: 0, errors: parsed.totalRecords,
        errorDetails: [{ row: 0, message: `Error: ${err.message}` }],
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
    totalFiles: files.length,
    summaries,
    totals,
  };
}

// ═══════════════════════════════════════════════════════════════
// IMPORTADOR CHEQUES
// ═══════════════════════════════════════════════════════════════

async function importCheques(
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

      const sale = await prisma.sale.create({
        data: {
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
        } as any,
      });

      existingFolios.set(folio, sale.id);
      imported++;
    } catch (err: any) {
      errors++;
      errorDetails.push({
        row: rowNum,
        message: err.message?.slice(0, 200) ?? "Error",
      });
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
// IMPORTADOR MOVIMIENTOS CAJA
// ═══════════════════════════════════════════════════════════════

async function importMovtosCaja(
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
        message: err.message?.slice(0, 200) ?? "Error",
      });
    }
  }

  return {
    filename, fileType: "movtoscaja",
    totalRecords: parsed.records.length,
    imported, skipped, errors,
    errorDetails: errorDetails.slice(0, 50),
  };
}

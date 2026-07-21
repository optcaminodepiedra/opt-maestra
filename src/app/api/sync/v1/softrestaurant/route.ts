import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  importSoftRestaurantSalesChunk,
  type SoftRestaurantCheque,
  type SoftRestaurantLine,
  type SoftRestaurantPayment,
} from "@/lib/softrestaurant-sync";

const db = prisma as any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim();
}

async function authenticateConnector(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token || !token.startsWith("opt_sync_")) return null;

  return db.integrationConnector.findUnique({
    where: { agentTokenHash: hashToken(token) },
    include: {
      business: { select: { id: true, name: true } },
    },
  });
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asPositiveInt(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
}

async function findFallbackUserId(connector: any) {
  if (connector.createdById) {
    const creator = await db.user.findFirst({
      where: { id: connector.createdById, isActive: true },
      select: { id: true },
    });
    if (creator) return creator.id;
  }

  const master = await db.user.findFirst({
    where: { role: "MASTER_ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (master) return master.id;

  const activeUser = await db.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!activeUser) throw new Error("No existe un usuario activo para registrar la importación.");
  return activeUser.id;
}

async function findOrCreateCashpoint(businessId: string) {
  const current = await db.cashpoint.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (current) return current.id;

  const created = await db.cashpoint.create({
    data: { businessId, name: "Caja Principal" },
    select: { id: true },
  });
  return created.id;
}

async function startRun(connector: any, body: Record<string, any>) {
  const snapshotId = String(body.snapshotId || "").trim();
  if (!snapshotId) throw new Error("Falta snapshotId.");

  // Si el agente perdió la respuesta del inicio, reutilizamos el mismo proceso.
  const existingRun = await db.integrationRun.findFirst({
    where: {
      connectorId: connector.id,
      status: "RUNNING",
      checkpoint: snapshotId,
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (existingRun) {
    return {
      ok: true,
      resumed: true,
      runId: existingRun.id,
      businessId: connector.businessId,
      businessName: connector.business.name,
      snapshotId,
    };
  }

  const userId = await findFallbackUserId(connector);
  const cashpointId = await findOrCreateCashpoint(connector.businessId);
  const totalCheques = asPositiveInt(body.totalCheques);
  const totalLines = asPositiveInt(body.totalLines);
  const totalPayments = asPositiveInt(body.totalPayments);
  const now = new Date();

  const importBatch = await db.importBatch.create({
    data: {
      entityType: "SALES",
      businessId: connector.businessId,
      filename: `Agente ${connector.name} · ${snapshotId}`.slice(0, 500),
      totalRows: totalCheques,
      status: "PROCESSING",
      note: `Sincronización automática: ${totalCheques} tickets, ${totalLines} líneas, ${totalPayments} pagos`,
      createdById: userId,
    },
    select: { id: true },
  });

  const details = {
    snapshotId,
    importBatchId: importBatch.id,
    cashpointId,
    userId,
    agentVersion: body.agentVersion || null,
    computerName: body.computerName || null,
    sourceVersion: body.sourceVersion || null,
    xmlFolder: body.xmlFolder || null,
    totalCheques,
    totalLines,
    totalPayments,
    linesInserted: 0,
    paymentsInserted: 0,
    phantomsCreated: 0,
    canceledSales: 0,
    chunksProcessed: 0,
  };

  const run = await db.integrationRun.create({
    data: {
      connectorId: connector.id,
      status: "RUNNING",
      recordsRead: 0,
      details,
      checkpoint: snapshotId,
    },
    select: { id: true },
  });

  const previousConfig = asObject(connector.config);
  await db.integrationConnector.update({
    where: { id: connector.id },
    data: {
      status: "ACTIVE",
      lastSeenAt: now,
      lastSyncAt: now,
      lastError: null,
      config: {
        ...previousConfig,
        agentVersion: body.agentVersion || previousConfig.agentVersion || null,
        computerName: body.computerName || previousConfig.computerName || null,
        sourceVersion: body.sourceVersion || previousConfig.sourceVersion || null,
        xmlFolder: body.xmlFolder || previousConfig.xmlFolder || null,
      },
    },
  });

  return {
    ok: true,
    runId: run.id,
    businessId: connector.businessId,
    businessName: connector.business.name,
    snapshotId,
  };
}

async function processChunk(connector: any, body: Record<string, any>) {
  const runId = String(body.runId || "").trim();
  if (!runId) throw new Error("Falta runId.");

  const cheques = Array.isArray(body.cheques) ? body.cheques as SoftRestaurantCheque[] : [];
  if (cheques.length > 100) {
    return NextResponse.json({ error: "El bloque excede 100 tickets." }, { status: 413 });
  }

  const cheqdetByFolio = asObject(body.cheqdetByFolio) as Record<string, SoftRestaurantLine[]>;
  const pagosByFolio = asObject(body.pagosByFolio) as Record<string, SoftRestaurantPayment[]>;
  const canceladosFolios = Array.isArray(body.canceladosFolios)
    ? body.canceladosFolios.map((value: unknown) => String(value))
    : [];

  const run = await db.integrationRun.findFirst({
    where: {
      id: runId,
      connectorId: connector.id,
      status: "RUNNING",
    },
    select: {
      id: true,
      details: true,
    },
  });
  if (!run) throw new Error("El proceso no existe, ya terminó o pertenece a otra conexión.");

  const details = asObject(run.details);
  const importBatchId = String(details.importBatchId || "");
  const cashpointId = String(details.cashpointId || "");
  const userId = String(details.userId || "");
  if (!importBatchId || !cashpointId || !userId) {
    throw new Error("El proceso no contiene el contexto necesario para importar.");
  }

  const result = await importSoftRestaurantSalesChunk({
    businessId: connector.businessId,
    cashpointId,
    userId,
    importBatchId,
    cheques,
    cheqdetByFolio,
    pagosByFolio,
    canceladosFolios,
  });

  const nextDetails = {
    ...details,
    linesInserted: asPositiveInt(details.linesInserted) + result.linesCreated,
    paymentsInserted: asPositiveInt(details.paymentsInserted) + result.paymentsCreated,
    phantomsCreated: asPositiveInt(details.phantomsCreated) + result.phantomsCreated,
    canceledSales: asPositiveInt(details.canceledSales) + result.canceledSales,
    chunksProcessed: asPositiveInt(details.chunksProcessed) + 1,
    lastChunkIndex: asPositiveInt(body.chunkIndex),
    lastChunkAt: new Date().toISOString(),
    lastErrors: result.errors,
  };

  await db.$transaction([
    db.integrationRun.update({
      where: { id: run.id },
      data: {
        recordsRead: { increment: cheques.length },
        recordsInserted: { increment: result.salesCreated },
        recordsUpdated: { increment: result.salesUpdated },
        recordsSkipped: { increment: result.salesSkipped },
        recordsFailed: { increment: result.salesErrors },
        details: nextDetails,
      },
    }),
    db.importBatch.update({
      where: { id: importBatchId },
      data: {
        successRows: { increment: result.salesCreated },
        errorRows: { increment: result.salesErrors },
      },
    }),
    db.integrationConnector.update({
      where: { id: connector.id },
      data: {
        status: "ACTIVE",
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, runId, stats: result });
}

async function finishRun(connector: any, body: Record<string, any>) {
  const runId = String(body.runId || "").trim();
  if (!runId) throw new Error("Falta runId.");

  const run = await db.integrationRun.findFirst({
    where: { id: runId, connectorId: connector.id },
    select: {
      id: true,
      status: true,
      recordsRead: true,
      recordsInserted: true,
      recordsUpdated: true,
      recordsSkipped: true,
      recordsFailed: true,
      details: true,
      checkpoint: true,
    },
  });
  if (!run) throw new Error("El proceso no existe o pertenece a otra conexión.");
  if (run.status !== "RUNNING") {
    return { ok: true, alreadyFinished: true, runId: run.id, status: run.status };
  }

  const details = asObject(run.details);
  const importBatchId = String(details.importBatchId || "");
  const status = run.recordsFailed === 0
    ? "SUCCESS"
    : run.recordsInserted + run.recordsUpdated + run.recordsSkipped > 0
      ? "PARTIAL"
      : "FAILED";
  const now = new Date();
  const errorSummary = status === "FAILED"
    ? String(body.errorSummary || "La sincronización no pudo importar registros.")
    : status === "PARTIAL"
      ? `${run.recordsFailed} registros presentaron errores.`
      : null;

  const finalDetails = {
    ...details,
    finishedByAgentAt: body.finishedAt || null,
    checkpoint: body.checkpoint || run.checkpoint || null,
    finalAgentStats: asObject(body.stats),
  };

  const operations: any[] = [
    db.integrationRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: now,
        checkpoint: String(body.checkpoint || run.checkpoint || "") || null,
        errorSummary,
        details: finalDetails,
      },
    }),
    db.integrationConnector.update({
      where: { id: connector.id },
      data: {
        status: status === "FAILED" ? "ERROR" : "ACTIVE",
        lastSeenAt: now,
        lastSyncAt: now,
        lastSuccessAt: status === "FAILED" ? connector.lastSuccessAt : now,
        lastError: errorSummary,
        config: {
          ...asObject(connector.config),
          lastCheckpoint: body.checkpoint || run.checkpoint || null,
          lastSnapshotId: details.snapshotId || null,
        },
      },
    }),
  ];

  if (importBatchId) {
    operations.push(db.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: status === "FAILED" ? "FAILED" : "COMPLETED",
        completedAt: now,
        note: [
          `Automático: ${run.recordsInserted} ventas nuevas`,
          `${run.recordsUpdated} actualizadas`,
          `${run.recordsSkipped} omitidas`,
          `${run.recordsFailed} errores`,
          `${asPositiveInt(details.linesInserted)} líneas`,
          `${asPositiveInt(details.paymentsInserted)} pagos`,
        ].join(" · "),
        errors: run.recordsFailed > 0 ? (details.lastErrors || []) : undefined,
      },
    }));
  }

  await db.$transaction(operations);

  return {
    ok: true,
    runId: run.id,
    status,
    totals: {
      read: run.recordsRead,
      inserted: run.recordsInserted,
      updated: run.recordsUpdated,
      skipped: run.recordsSkipped,
      failed: run.recordsFailed,
      linesInserted: asPositiveInt(details.linesInserted),
      paymentsInserted: asPositiveInt(details.paymentsInserted),
    },
  };
}

export async function POST(req: NextRequest) {
  const connector = await authenticateConnector(req);
  if (!connector || connector.source !== "SOFTRESTAURANT" || !connector.isActive) {
    return NextResponse.json({ error: "Conexión no autorizada." }, { status: 401 });
  }

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo JSON no es válido." }, { status: 400 });
  }

  const action = String(body.action || "").toLowerCase();

  try {
    if (action === "start") {
      return NextResponse.json(await startRun(connector, body));
    }
    if (action === "chunk") {
      return await processChunk(connector, body);
    }
    if (action === "finish") {
      return NextResponse.json(await finishRun(connector, body));
    }
    return NextResponse.json({ error: "Acción no válida. Usa start, chunk o finish." }, { status: 400 });
  } catch (error: any) {
    const message = error?.message?.slice(0, 500) || "Error de sincronización.";
    console.error(`[sync-softrestaurant] ${connector.name}:`, error);

    try {
      await db.integrationConnector.update({
        where: { id: connector.id },
        data: {
          status: "ERROR",
          lastSeenAt: new Date(),
          lastError: message,
        },
      });

      const runId = String(body.runId || "");
      if (runId) {
        const failedRun = await db.integrationRun.findFirst({
          where: { id: runId, connectorId: connector.id, status: "RUNNING" },
          select: { id: true, details: true },
        });
        if (failedRun) {
          const failedDetails = asObject(failedRun.details);
          const importBatchId = String(failedDetails.importBatchId || "");
          const failOperations: any[] = [
            db.integrationRun.update({
              where: { id: failedRun.id },
              data: {
                status: "FAILED",
                finishedAt: new Date(),
                errorSummary: message,
              },
            }),
          ];
          if (importBatchId) {
            failOperations.push(db.importBatch.update({
              where: { id: importBatchId },
              data: {
                status: "FAILED",
                completedAt: new Date(),
                note: `Sincronización automática interrumpida: ${message}`,
              },
            }));
          }
          await db.$transaction(failOperations);
        }
      }
    } catch {
      // No ocultamos el error original si el registro de diagnóstico también falla.
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

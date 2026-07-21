"use server";

import { createHash, randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

const DIRECTION_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export type IntegrationSourceInput = "SOFTRESTAURANT" | "GOOGLE_SHEETS_HOTEL";

type SessionUser = {
  id?: string;
  fullName?: string;
  name?: string | null;
  username?: string;
  role?: string;
};

async function requireDirection() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Sesión no válida.");

  const me = session.user as SessionUser;
  if (!me.id || !me.role || !DIRECTION_ROLES.includes(me.role)) {
    throw new Error("No tienes permiso para administrar integraciones.");
  }

  return {
    id: me.id,
    role: me.role,
    name: me.fullName || me.name || me.username || "Administrador",
  };
}

function createAgentToken() {
  return `opt_sync_${randomBytes(28).toString("base64url")}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function extractSpreadsheetId(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || clean;
}

export async function createIntegrationConnector(input: {
  businessId: string;
  name: string;
  source: IntegrationSourceInput;
  spreadsheetId?: string;
  sheetName?: string;
  range?: string;
  syncEveryMinutes?: number;
}) {
  const me = await requireDirection();

  const businessId = input.businessId?.trim();
  const name = input.name?.trim();
  if (!businessId) throw new Error("Selecciona un negocio.");
  if (!name || name.length < 3) throw new Error("Escribe un nombre de al menos 3 caracteres.");
  if (!["SOFTRESTAURANT", "GOOGLE_SHEETS_HOTEL"].includes(input.source)) {
    throw new Error("Tipo de integración no válido.");
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) throw new Error("El negocio seleccionado no existe.");

  let rawToken: string | null = null;
  let agentTokenHash: string | null = null;
  let agentTokenPrefix: string | null = null;
  let config: Record<string, unknown> = {};

  if (input.source === "SOFTRESTAURANT") {
    rawToken = createAgentToken();
    agentTokenHash = hashToken(rawToken);
    agentTokenPrefix = `${rawToken.slice(0, 17)}…`;
    config = {
      pollEverySeconds: 60,
      watchMode: "folder",
    };
  } else {
    const spreadsheetId = extractSpreadsheetId(input.spreadsheetId || "");
    config = {
      spreadsheetId: spreadsheetId || null,
      sheetName: input.sheetName?.trim() || "Reservaciones",
      range: input.range?.trim() || "A:Z",
      syncEveryMinutes: Math.max(5, Number(input.syncEveryMinutes || 5)),
      mappingStatus: "PENDING",
    };
  }

  const connector = await db.integrationConnector.create({
    data: {
      businessId,
      name,
      source: input.source,
      status: "SETUP_REQUIRED",
      isActive: true,
      agentTokenHash,
      agentTokenPrefix,
      config: config as any,
      createdById: me.id,
    },
    select: { id: true, name: true, source: true },
  });

  await logAudit({
    user: me,
    businessId,
    action: "INTEGRATION_CREATED",
    entity: "IntegrationConnector",
    entityId: connector.id,
    severity: "MEDIUM",
    summary: `Creó la integración ${connector.name} (${connector.source}) para ${business.name}`,
    metadata: { source: connector.source },
  });

  revalidatePath("/app/admin/integrations");
  return { ok: true, connectorId: connector.id, token: rawToken };
}

export async function setIntegrationConnectorActive(connectorId: string, isActive: boolean) {
  const me = await requireDirection();

  const current = await db.integrationConnector.findUnique({
    where: { id: connectorId },
    include: { business: { select: { name: true } } },
  });
  if (!current) throw new Error("La integración no existe.");

  const nextStatus = isActive
    ? current.lastSeenAt || current.lastSuccessAt
      ? "ACTIVE"
      : "SETUP_REQUIRED"
    : "PAUSED";

  await db.integrationConnector.update({
    where: { id: connectorId },
    data: { isActive, status: nextStatus },
  });

  await logAudit({
    user: me,
    businessId: current.businessId,
    action: isActive ? "INTEGRATION_ACTIVATED" : "INTEGRATION_PAUSED",
    entity: "IntegrationConnector",
    entityId: current.id,
    severity: "MEDIUM",
    summary: `${isActive ? "Activó" : "Pausó"} la integración ${current.name} de ${current.business.name}`,
  });

  revalidatePath("/app/admin/integrations");
  return { ok: true };
}

export async function regenerateIntegrationAgentToken(connectorId: string) {
  const me = await requireDirection();

  const current = await db.integrationConnector.findUnique({
    where: { id: connectorId },
    include: { business: { select: { name: true } } },
  });
  if (!current) throw new Error("La integración no existe.");
  if (current.source !== "SOFTRESTAURANT") {
    throw new Error("Solo las conexiones de SoftRestaurant utilizan token de agente.");
  }

  const token = createAgentToken();
  await db.integrationConnector.update({
    where: { id: connectorId },
    data: {
      agentTokenHash: hashToken(token),
      agentTokenPrefix: `${token.slice(0, 17)}…`,
      lastSeenAt: null,
      status: "SETUP_REQUIRED",
      lastError: null,
      isActive: true,
    },
  });

  await logAudit({
    user: me,
    businessId: current.businessId,
    action: "INTEGRATION_TOKEN_REGENERATED",
    entity: "IntegrationConnector",
    entityId: current.id,
    severity: "HIGH",
    summary: `Regeneró el token de ${current.name} para ${current.business.name}`,
  });

  revalidatePath("/app/admin/integrations");
  return { ok: true, token };
}

export async function deleteIntegrationConnector(connectorId: string) {
  const me = await requireDirection();

  const current = await db.integrationConnector.findUnique({
    where: { id: connectorId },
    include: {
      business: { select: { name: true } },
      _count: { select: { runs: true } },
    },
  });
  if (!current) throw new Error("La integración no existe.");
  if (current._count.runs > 0) {
    throw new Error("Esta integración ya tiene historial. Paúsala en lugar de eliminarla.");
  }

  await db.integrationConnector.delete({ where: { id: connectorId } });

  await logAudit({
    user: me,
    businessId: current.businessId,
    action: "INTEGRATION_DELETED",
    entity: "IntegrationConnector",
    entityId: current.id,
    severity: "HIGH",
    summary: `Eliminó la integración ${current.name} de ${current.business.name}`,
  });

  revalidatePath("/app/admin/integrations");
  return { ok: true };
}

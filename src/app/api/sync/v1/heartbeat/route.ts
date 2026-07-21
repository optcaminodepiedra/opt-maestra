import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim();
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token || !token.startsWith("opt_sync_")) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let body: { agentVersion?: string; computerName?: string; sourceVersion?: string } = {};
  try {
    body = await req.json();
  } catch {
    // El heartbeat también es válido sin body.
  }

  const connector = await db.integrationConnector.findUnique({
    where: { agentTokenHash: hashToken(token) },
    include: { business: { select: { id: true, name: true } } },
  });

  if (!connector || connector.source !== "SOFTRESTAURANT" || !connector.isActive) {
    return NextResponse.json({ error: "Conexión no autorizada" }, { status: 401 });
  }

  const now = new Date();
  const previousConfig = (connector.config || {}) as Record<string, unknown>;
  const nextConfig = {
    ...previousConfig,
    agentVersion: body.agentVersion || previousConfig.agentVersion || null,
    computerName: body.computerName || previousConfig.computerName || null,
    sourceVersion: body.sourceVersion || previousConfig.sourceVersion || null,
  };

  await db.integrationConnector.update({
    where: { id: connector.id },
    data: {
      lastSeenAt: now,
      status: "ACTIVE",
      lastError: null,
      config: nextConfig as any,
    },
  });

  return NextResponse.json({
    ok: true,
    serverTime: now.toISOString(),
    connector: {
      id: connector.id,
      name: connector.name,
      businessId: connector.business.id,
      businessName: connector.business.name,
      source: connector.source,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

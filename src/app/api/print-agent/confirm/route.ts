import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/print-agent/confirm
 *
 * Body: {
 *   token: string,
 *   jobs: [
 *     { id: string, status: "PRINTED" | "FAILED", error?: string }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { token, jobs } = body;

  if (!token || !token.startsWith("cdp_")) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
  if (!Array.isArray(jobs)) {
    return NextResponse.json({ error: "jobs[] requerido" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { printAgentToken: token } as any,
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Token no reconocido" }, { status: 401 });
  }

  // Marcar lastSeenAt de las impresoras involucradas
  const now = new Date();

  let printed = 0;
  let failed = 0;

  for (const j of jobs) {
    if (!j.id || !j.status) continue;

    const job = await prisma.printJob.findUnique({
      where: { id: j.id },
      select: { businessId: true, printerId: true, attempts: true },
    });
    if (!job || job.businessId !== business.id) continue;

    if (j.status === "PRINTED") {
      await prisma.printJob.update({
        where: { id: j.id },
        data: {
          status: "PRINTED",
          printedAt: now,
          attempts: job.attempts + 1,
        },
      });
      printed++;

      if (job.printerId) {
        await prisma.printer.update({
          where: { id: job.printerId },
          data: { lastSeenAt: now },
        });
      }
    } else if (j.status === "FAILED") {
      await prisma.printJob.update({
        where: { id: j.id },
        data: {
          status: "FAILED",
          attempts: job.attempts + 1,
          lastError: j.error?.toString().slice(0, 500) ?? "Error desconocido",
        },
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, printed, failed });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

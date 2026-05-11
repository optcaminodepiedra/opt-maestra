import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/print-agent/jobs?token=XXX
 *
 * Print Agent local hace polling cada 3 segundos.
 * Devuelve hasta 10 PrintJobs pendientes y los marca como PRINTING.
 *
 * Si no hay jobs, devuelve { jobs: [] } y el agent espera.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || !token.startsWith("cdp_")) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // Identificar el negocio por token
  const business = await prisma.business.findFirst({
    where: { printAgentToken: token } as any,
    select: { id: true, name: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Token no reconocido" }, { status: 401 });
  }

  // Tomar hasta 10 trabajos PENDING del negocio
  // Atomic: actualizar a PRINTING al mismo tiempo que se devuelven
  const pending = await prisma.printJob.findMany({
    where: {
      businessId: business.id,
      status: "PENDING",
    },
    include: {
      printer: {
        select: { id: true, name: true, role: true, ipAddress: true, port: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  if (pending.length === 0) {
    return NextResponse.json({ jobs: [], businessName: business.name });
  }

  // Marcar como PRINTING
  await prisma.printJob.updateMany({
    where: { id: { in: pending.map((j) => j.id) } },
    data: {
      status: "PRINTING",
      claimedAt: new Date(),
    },
  });

  // Devolver al agent
  return NextResponse.json({
    businessName: business.name,
    jobs: pending.map((j) => ({
      id: j.id,
      type: j.type,
      printer: j.printer
        ? {
            id: j.printer.id,
            name: j.printer.name,
            role: j.printer.role,
            ipAddress: j.printer.ipAddress,
            port: j.printer.port,
          }
        : null,
      rawBytes: j.rawBytes, // base64
      attempts: j.attempts,
    })),
  });
}

// CORS para que el Print Agent local pueda hacer requests
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

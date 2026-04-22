import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Falta archivo" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo muy grande (máx 10 MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Usar la primera hoja (o "Datos" si existe)
    const sheetName = wb.SheetNames.includes("Datos") ? "Datos" : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: true,
    });

    // Filtrar filas completamente vacías
    const cleaned = rows.filter((row) =>
      Object.values(row).some((v) => v !== "" && v != null)
    );

    return NextResponse.json({
      filename: file.name,
      rowCount: cleaned.length,
      rows: cleaned,
      columns: cleaned.length > 0 ? Object.keys(cleaned[0]) : [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al parsear archivo: ${err.message}` },
      { status: 400 }
    );
  }
}

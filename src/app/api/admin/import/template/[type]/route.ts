import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTemplate, type ImportEntityType } from "@/lib/import-templates";
import * as XLSX from "xlsx";

const ADMIN_ROLES = ["MASTER_ADMIN", "OWNER", "SUPERIOR"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (!ADMIN_ROLES.includes(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { type } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";

  let tpl;
  try {
    tpl = getTemplate(type.toUpperCase() as ImportEntityType);
  } catch {
    return new NextResponse("Unknown template type", { status: 400 });
  }

  // Construir filas: header + ejemplos
  const headers = tpl.columns.map((c) => c.key);
  const exampleRows = tpl.exampleRows;

  // Hoja 1: Datos
  const wsData = [
    headers,
    ...exampleRows.map((row) => headers.map((h) => row[h] ?? "")),
  ];

  // Hoja 2: Instrucciones
  const instructions: any[][] = [
    ["INSTRUCCIONES — " + tpl.label.toUpperCase()],
    [""],
    [tpl.description],
    [""],
    ["IMPORTANTE:"],
    ["• No cambies los nombres de las columnas (primera fila)."],
    ["• Las columnas marcadas como REQUERIDA son obligatorias."],
    ["• Las filas de ejemplo en la hoja 'Datos' puedes borrarlas."],
    ["• Puedes subir este archivo en formato .xlsx o .csv"],
    [""],
    ["COLUMNAS:"],
    ["Columna", "Etiqueta", "Requerida", "Tipo", "Descripción", "Ejemplo"],
    ...tpl.columns.map((c) => [
      c.key,
      c.label,
      c.required ? "SÍ" : "no",
      c.type,
      c.description,
      String(c.example),
    ]),
  ];

  if (tpl.columns.some((c) => c.enumOptions)) {
    instructions.push([""], ["VALORES PERMITIDOS (columnas tipo enum):"]);
    for (const c of tpl.columns) {
      if (c.enumOptions) {
        instructions.push([c.label + ":", c.enumOptions.join(", ")]);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  const wsDataSheet = XLSX.utils.aoa_to_sheet(wsData);
  const wsInstructionsSheet = XLSX.utils.aoa_to_sheet(instructions);

  XLSX.utils.book_append_sheet(wb, wsDataSheet, "Datos");
  XLSX.utils.book_append_sheet(wb, wsInstructionsSheet, "Instrucciones");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(wsDataSheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="plantilla-${type.toLowerCase()}.csv"`,
      },
    });
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-${type.toLowerCase()}.xlsx"`,
    },
  });
}

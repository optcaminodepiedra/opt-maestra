"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ExportView({ data }: { data: any[] }) {

  const handleDownload = () => {
    if (data.length === 0) {
      alert("No hay datos para exportar este mes.");
      return;
    }

    // 1. Extraemos los nombres de las columnas (ID, Tipo, Concepto, etc.)
    const headers = Object.keys(data[0]);
    
    // 2. Convertimos los datos en filas de texto separadas por comas
    const csvRows = data.map(row => {
      return headers.map(header => {
        const val = row[header as keyof typeof row];
        // Escapamos las comillas y envolvemos en texto para que Excel no se confunda con comas en los conceptos
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",");
    });

    // 3. Unimos los encabezados y las filas con saltos de línea
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    
    // 4. EL TRUCO DE MAGIA: Agregamos el BOM (Byte Order Mark) 
    // Esto obliga a Excel en Windows a leer el archivo en UTF-8 y no destruir los acentos
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // 5. Creamos un enlace invisible, le damos clic automático y lo destruimos
    const link = document.createElement("a");
    link.href = url;
    const mes = new Date().toLocaleString("es-MX", { month: "long" }).toUpperCase();
    link.setAttribute("download", `Contabilidad_OPT_${mes}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" asChild>
          <Link href="/app/accounting"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exportar Datos</h1>
          <p className="text-muted-foreground mt-1">
            Descarga los movimientos financieros para tu contador.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Corte del Mes Actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Este archivo contiene <strong>{data.length} movimientos</strong> (Ingresos y Egresos) de todas las unidades de negocio. Está en formato CSV, listo para abrirse en Microsoft Excel, Google Sheets o Numbers.
          </p>
          
          <Button onClick={handleDownload} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
            <FileDown className="w-4 h-4 mr-2" />
            Descargar Archivo Excel (CSV)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
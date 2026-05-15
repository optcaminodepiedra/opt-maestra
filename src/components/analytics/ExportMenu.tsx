"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, ChevronDown, FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/export-excel.actions";

export function ExportMenu() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  function downloadBase64(base64: string, filename: string, mimeType: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExcel() {
    setError(null);
    const params = Object.fromEntries(searchParams.entries());
    start(async () => {
      try {
        const { base64, filename } = await exportToExcel(params);
        downloadBase64(
          base64,
          filename,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      } catch (err: any) {
        setError(err.message ?? "Error al exportar");
      }
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          Exportar
          <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExcel} disabled={pending}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2 text-blue-600" />
          Imprimir / PDF
        </DropdownMenuItem>
        {error && (
          <div className="px-2 py-1.5 text-xs text-red-600">{error}</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, X, Check, AlertCircle, Loader2,
  FileCheck, FilePlus, FileX,
} from "lucide-react";

type Props = {
  businessId: string;
  businessName: string;
};

type FileItem = {
  file: File;
  status: "pending" | "ready" | "error";
  error?: string;
};

type ImportSummary = {
  filename: string;
  fileType: string;
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

// ═══════════════════════════════════════════════════════════════
// Sube UN archivo por request al route handler /api/upload-xml.
// Route handlers de Next.js NO tienen el límite de 4.5MB de Server
// Actions. Pueden recibir hasta ~50MB vía multipart/form-data.
// ═══════════════════════════════════════════════════════════════

export function XmlImportClient({ businessId, businessName }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles: FileItem[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        newFiles.push({ file, status: "error", error: "No es .xml" });
        continue;
      }
      newFiles.push({ file, status: "ready" });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setFiles([]);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  async function uploadFile(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append("businessId", businessId);
    formData.append("file_0", file);

    const res = await fetch("/api/upload-xml", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try {
        const j = JSON.parse(txt);
        msg = j.error ?? txt;
      } catch {}
      throw new Error(`${res.status}: ${msg}`);
    }

    return res.json();
  }

  async function handleImport() {
    setError(null);
    setResult(null);
    setProgress(null);

    const readyFiles = files.filter((f) => f.status === "ready");
    if (readyFiles.length === 0) {
      setError("No hay archivos válidos para importar");
      return;
    }

    start(async () => {
      try {
        const allSummaries: ImportSummary[] = [];
        let lastBatchId = "";

        for (let i = 0; i < readyFiles.length; i++) {
          const fi = readyFiles[i];
          setProgress({
            current: i + 1,
            total: readyFiles.length,
            filename: fi.file.name,
          });

          try {
            const res = await uploadFile(fi.file);
            allSummaries.push(...res.summaries);
            lastBatchId = res.batchId;
          } catch (err: any) {
            allSummaries.push({
              filename: fi.file.name,
              fileType: "unknown",
              totalRecords: 0,
              imported: 0,
              skipped: 0,
              errors: 1,
              errorDetails: [{ row: 0, message: err.message ?? "Error de red" }],
            });
          }
        }

        const totals = {
          totalRecords: allSummaries.reduce((s, x) => s + x.totalRecords, 0),
          imported: allSummaries.reduce((s, x) => s + x.imported, 0),
          skipped: allSummaries.reduce((s, x) => s + x.skipped, 0),
          errors: allSummaries.reduce((s, x) => s + x.errors, 0),
        };

        setResult({
          batchId: lastBatchId,
          businessId,
          totalFiles: readyFiles.length,
          summaries: allSummaries,
          totals,
        });
        setProgress(null);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Error al importar");
        setProgress(null);
      }
    });
  }

  const readyCount = files.filter((f) => f.status === "ready").length;
  const totalSize = files.reduce((s, f) => s + f.file.size, 0);
  const totalSizeMB = totalSize / (1024 * 1024);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar XMLs SoftRestaurant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Destino: <strong>{businessName}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Sube uno o varios archivos .xml de SoftRestaurant. Cada archivo se sube
            individualmente al servidor (soporta hasta ~50MB por archivo).
            El sistema detecta automáticamente el tipo y previene duplicados por folio.
          </p>

          <label
            htmlFor="xml-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/30 transition"
          >
            <FilePlus className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Click para seleccionar archivos</p>
            <p className="text-xs text-muted-foreground mt-1">
              .xml · puedes seleccionar varios a la vez
            </p>
            <input
              id="xml-upload"
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Archivos ({files.length}) · {readyCount} listo{readyCount !== 1 ? "s" : ""}
                <span className="text-xs text-muted-foreground ml-2">
                  ({totalSizeMB.toFixed(2)} MB total)
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={pending}>
                <X className="w-3.5 h-3.5 mr-1" /> Quitar todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-72 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-3 text-sm">
                  {f.status === "ready" && <FileCheck className="w-4 h-4 text-green-600" />}
                  {f.status === "error" && <FileX className="w-4 h-4 text-red-600" />}
                  <span className="flex-1 truncate">{f.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(f.file.size / 1024).toFixed(1)} KB
                  </span>
                  {f.error && (
                    <Badge variant="destructive" className="text-[10px]">{f.error}</Badge>
                  )}
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    onClick={() => removeFile(i)}
                    disabled={pending}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {readyCount > 0 && !result && (
        <Card className="border-primary">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{readyCount}</strong> archivo{readyCount !== 1 ? "s" : ""} listo{readyCount !== 1 ? "s" : ""}
            </p>
            <Button onClick={handleImport} disabled={pending} size="lg">
              {pending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importando…</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Importar a {businessName}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {progress && (
        <Card className="border-blue-300 bg-blue-50/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-700">
                Procesando archivo {progress.current} de {progress.total}
              </p>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            </div>
            <p className="text-xs text-blue-700/70 truncate">{progress.filename}</p>
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {result && (
        <Card className="border-green-300">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Importación completada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="text-center p-3 bg-blue-50 rounded">
                <p className="text-2xl font-bold text-blue-700">{result.totals.totalRecords}</p>
                <p className="text-xs text-muted-foreground">Total registros</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-700">{result.totals.imported}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded">
                <p className="text-2xl font-bold text-amber-700">{result.totals.skipped}</p>
                <p className="text-xs text-muted-foreground">Omitidos</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded">
                <p className="text-2xl font-bold text-red-700">{result.totals.errors}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
            </div>

            <div className="border rounded">
              <div className="px-3 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wide">
                Detalle por archivo
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {result.summaries.map((s, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">{s.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: <code>{s.fileType}</code> · {s.totalRecords} registros
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {s.imported > 0 && (
                          <Badge className="bg-green-100 text-green-700 border-green-300">
                            ✓ {s.imported} importados
                          </Badge>
                        )}
                        {s.skipped > 0 && (
                          <Badge variant="secondary">{s.skipped} omitidos</Badge>
                        )}
                        {s.errors > 0 && (
                          <Badge variant="destructive">{s.errors} errores</Badge>
                        )}
                      </div>
                    </div>
                    {s.errorDetails.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Ver detalles ({s.errorDetails.length})
                        </summary>
                        <ul className="mt-1 ml-3 space-y-0.5">
                          {s.errorDetails.slice(0, 20).map((e, j) => (
                            <li key={j} className="text-muted-foreground">
                              Fila {e.row}: {e.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

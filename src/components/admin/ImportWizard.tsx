"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, ArrowRight,
  ArrowLeft, AlertCircle, Loader2, FileText, Building2, Database,
  DollarSign, TrendingDown, Wallet, BedDouble, Users, Package,
} from "lucide-react";
import { listTemplates, type ImportEntityType, type TemplateDefinition } from "@/lib/import-templates";
import { runImport, type ImportResult } from "@/lib/import.actions";

type Business = { id: string; name: string };

type Props = {
  businesses: Business[];
};

type Step = "type" | "business" | "upload" | "preview" | "result";

const ICON_MAP: Record<string, any> = {
  DollarSign, TrendingDown, Wallet, BedDouble, Users, Package, FileText,
};

export function ImportWizard({ businesses }: Props) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("type");
  const [template, setTemplate] = useState<TemplateDefinition | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsing, setParsing] = useState(false);

  const templates = listTemplates();

  function reset() {
    setStep("type");
    setTemplate(null);
    setBusinessId(null);
    setFilename("");
    setRows([]);
    setError(null);
    setResult(null);
  }

  function selectTemplate(tpl: TemplateDefinition) {
    setTemplate(tpl);
    setError(null);
    if (tpl.needsBusiness) {
      if (businesses.length === 1) {
        setBusinessId(businesses[0].id);
        setStep("upload");
      } else {
        setStep("business");
      }
    } else {
      setStep("upload");
    }
  }

  async function handleFile(file: File) {
    setParsing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/import/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al parsear");
      if (data.rowCount === 0) throw new Error("El archivo está vacío");

      setFilename(data.filename);
      setRows(data.rows);
      setStep("preview");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  function runFinalImport() {
    if (!template) return;
    startTransition(async () => {
      try {
        const res = await runImport(template.entityType, businessId, filename, rows);
        setResult(res);
        setStep("result");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function downloadTemplate(tpl: TemplateDefinition, format: "xlsx" | "csv") {
    const url = `/api/admin/import/template/${tpl.entityType.toLowerCase()}?format=${format}`;
    window.open(url, "_blank");
  }

  /* ═══════════════════════════ Step: Type ═══════════════════════════ */

  if (step === "type") {
    return (
      <div className="space-y-4">
        <StepIndicator current={1} total={5} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Qué quieres importar?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((tpl) => {
                const Icon = ICON_MAP[tpl.icon] ?? FileText;
                return (
                  <button
                    key={tpl.entityType}
                    onClick={() => selectTemplate(tpl)}
                    className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <Icon className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">{tpl.label}</h3>
                      {tpl.needsBusiness && (
                        <Badge variant="outline" className="text-[9px] ml-auto">
                          Por negocio
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{tpl.description}</p>
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); downloadTemplate(tpl, "xlsx"); }}
                      >
                        <Download className="w-3 h-3 mr-1" /> Plantilla Excel
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); downloadTemplate(tpl, "csv"); }}
                      >
                        <Download className="w-3 h-3 mr-1" /> CSV
                      </Button>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════ Step: Business ═══════════════════════════ */

  if (step === "business") {
    return (
      <div className="space-y-4">
        <StepIndicator current={2} total={5} />
        <Button variant="ghost" size="sm" onClick={() => setStep("type")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Selecciona el negocio para: {template?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBusinessId(b.id); setStep("upload"); }}
                  className="flex items-center gap-3 border rounded-lg p-3 hover:border-primary hover:bg-muted/20 transition-colors text-left"
                >
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{b.name}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════ Step: Upload ═══════════════════════════ */

  if (step === "upload" && template) {
    const selectedBiz = businesses.find((b) => b.id === businessId);
    return (
      <div className="space-y-4">
        <StepIndicator current={3} total={5} />
        <Button variant="ghost" size="sm" onClick={() => setStep(template.needsBusiness && businesses.length > 1 ? "business" : "type")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Subir archivo — {template.label}
              {selectedBiz && (
                <Badge variant="secondary" className="ml-2">
                  <Building2 className="w-3 h-3 mr-1" /> {selectedBiz.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Antes de subir
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-5 list-disc">
                <li>Descarga la plantilla Excel o CSV de arriba.</li>
                <li>Rellena tus datos respetando las columnas.</li>
                <li>Puedes borrar las filas de ejemplo.</li>
                <li>No cambies los nombres de las columnas.</li>
                <li>Acepta formatos .xlsx, .xls y .csv · máximo 10 MB.</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(template, "xlsx")}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Descargar plantilla Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(template, "csv")}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Plantilla CSV
                </Button>
              </div>
            </div>

            <label className="block border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
                disabled={parsing}
              />
              {parsing ? (
                <>
                  <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">Click para seleccionar archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">o arrastra aquí</p>
                </>
              )}
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════ Step: Preview ═══════════════════════════ */

  if (step === "preview" && template) {
    const previewRows = rows.slice(0, 20);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const expectedColumns = template.columns.map((c) => c.key);
    const missingColumns = template.columns
      .filter((c) => c.required && !columns.includes(c.key))
      .map((c) => c.key);
    const extraColumns = columns.filter((c) => !expectedColumns.includes(c));

    return (
      <div className="space-y-4">
        <StepIndicator current={4} total={5} />
        <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Vista previa · {rows.length} filas detectadas
              </CardTitle>
              <span className="text-xs text-muted-foreground">{filename}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingColumns.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Faltan columnas requeridas:</p>
                  <p className="text-xs">{missingColumns.join(", ")}</p>
                </div>
              </div>
            )}
            {extraColumns.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>Columnas no reconocidas (serán ignoradas): {extraColumns.join(", ")}</p>
              </div>
            )}

            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground">#</th>
                    {expectedColumns.map((col) => {
                      const def = template.columns.find((c) => c.key === col);
                      return (
                        <th key={col} className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground">
                          {col}
                          {def?.required && <span className="text-red-500 ml-0.5">*</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1.5 text-muted-foreground">{idx + 2}</td>
                      {expectedColumns.map((col) => (
                        <td key={col} className="px-3 py-1.5 truncate max-w-[180px]">
                          {String(row[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/20 border-t">
                  ...y {rows.length - 20} filas más
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={reset} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={runFinalImport} disabled={pending || missingColumns.length > 0}>
                {pending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importando...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-1" /> Importar {rows.length} filas</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════════════ Step: Result ═══════════════════════════ */

  if (step === "result" && result) {
    const allOk = result.errors.length === 0;
    const anyError = result.errors.length > 0;
    const totalFailed = result.errors.length === result.total;

    return (
      <div className="space-y-4">
        <StepIndicator current={5} total={5} />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center space-y-2">
              {totalFailed ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold">Importación fallida</h2>
                  <p className="text-sm text-muted-foreground">
                    Ninguna fila se pudo procesar. Revisa los errores abajo.
                  </p>
                </>
              ) : allOk ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold">¡Importación completa!</h2>
                  <p className="text-sm text-muted-foreground">
                    {result.success} de {result.total} filas procesadas correctamente.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h2 className="text-xl font-bold">Importación parcial</h2>
                  <p className="text-sm text-muted-foreground">
                    {result.success} de {result.total} filas procesadas. {result.errors.length} con errores.
                  </p>
                </>
              )}
            </div>

            {anyError && (
              <div className="border rounded-lg">
                <div className="bg-red-50 border-b px-4 py-2">
                  <p className="text-sm font-medium text-red-700">
                    Errores ({result.errors.length})
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y">
                  {result.errors.map((err, i) => (
                    <div key={i} className="px-4 py-2 text-xs flex gap-3">
                      <span className="font-mono text-muted-foreground shrink-0">
                        Fila {err.row}
                      </span>
                      <span className="text-red-700">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={reset}>
                <Database className="w-4 h-4 mr-1" /> Importar más
              </Button>
              <Button variant="outline" asChild>
                <a href="/app/admin/import/history">
                  Ver historial <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full flex-1 ${
            i + 1 <= current ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

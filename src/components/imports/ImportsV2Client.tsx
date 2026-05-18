"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, FileArchive, CheckCircle2, AlertCircle, Loader2,
  Trash2, AlertTriangle, FileText, Database, Users, Package,
  Receipt, CreditCard, Calendar, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { importGrupos, importProductos, importMeseros } from "@/lib/import-catalogs.actions";
import { importVentasCompletas, importTurnos, resetBusinessSales } from "@/lib/import-sales.actions";

type Business = { id: string; name: string };

// Estructura de un archivo extraído del ZIP
type ExtractedFile = {
  name: string;
  content: string;  // texto UTF-8
  size: number;     // bytes original
};

// Identificación de los archivos
const FILE_IDENTITY: Record<string, { kind: string; icon: any; required: boolean; description: string }> = {
  "grupos.xml":      { kind: "GRUPOS",       icon: Package,    required: false, description: "Categorías de productos" },
  "productos.xml":   { kind: "PRODUCTOS",    icon: Package,    required: false, description: "Catálogo de productos" },
  "meseros.xml":     { kind: "MESEROS",      icon: Users,      required: false, description: "Lista de meseros" },
  "cheques.xml":     { kind: "CHEQUES",      icon: Receipt,    required: true,  description: "Ventas (tickets)" },
  "cheqdet.xml":     { kind: "CHEQDET",      icon: FileText,   required: true,  description: "Líneas de venta" },
  "chequespagos.xml":{ kind: "PAGOS",        icon: CreditCard, required: false, description: "Forma de pago por ticket" },
  "cancela.xml":     { kind: "CANCELA",      icon: X,          required: false, description: "Tickets cancelados" },
  "turnos.xml":      { kind: "TURNOS",       icon: Calendar,   required: false, description: "Cierres de caja" },
};

export default function ImportsV2Client(props: { businesses: Business[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Estado del wizard
  const [selectedBusiness, setSelectedBusiness] = useState<string>(props.businesses[0]?.id || "");
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Reset confirmation
  const [resetDialog, setResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  function log(msg: string) {
    setImportLog((cur) => [...cur, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  // ── Manejo de archivos ─────────────────────────────────────

  async function handleFiles(fileList: FileList) {
    setExtracting(true);
    setImportError(null);
    const extracted: ExtractedFile[] = [];

    try {
      for (const f of Array.from(fileList)) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          // Procesar ZIP
          log(`📦 Procesando ZIP: ${f.name}`);
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(await f.arrayBuffer());

          for (const fname of Object.keys(zip.files)) {
            const zf = zip.files[fname];
            if (zf.dir) continue;
            const lowerName = fname.split("/").pop()!.toLowerCase();
            if (FILE_IDENTITY[lowerName]) {
              const buf = await zf.async("arraybuffer");
              const text = new TextDecoder("windows-1252").decode(buf);
              extracted.push({ name: lowerName, content: text, size: buf.byteLength });
              log(`  ✓ ${lowerName} (${(buf.byteLength/1024).toFixed(1)} KB)`);
            }
          }
        } else if (f.name.toLowerCase().endsWith(".xml")) {
          const lowerName = f.name.toLowerCase();
          if (FILE_IDENTITY[lowerName]) {
            const buf = await f.arrayBuffer();
            const text = new TextDecoder("windows-1252").decode(buf);
            extracted.push({ name: lowerName, content: text, size: buf.byteLength });
            log(`✓ ${lowerName} cargado (${(buf.byteLength/1024).toFixed(1)} KB)`);
          } else {
            log(`⚠ ${f.name}: no reconocido, ignorado`);
          }
        }
      }

      // Dedupe (si subes el mismo archivo dos veces, queda el último)
      const map = new Map<string, ExtractedFile>();
      for (const ef of [...files, ...extracted]) {
        map.set(ef.name, ef);
      }
      setFiles(Array.from(map.values()));
    } catch (e: any) {
      setImportError(`Error al procesar archivos: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  }

  function clearFiles() {
    setFiles([]);
    setImportLog([]);
    setImportResult(null);
    setImportError(null);
  }

  // ── Importación ────────────────────────────────────────────

  async function runImport() {
    if (!selectedBusiness) {
      setImportError("Selecciona un negocio");
      return;
    }
    const required = ["cheques.xml", "cheqdet.xml"];
    const missing = required.filter((r) => !files.some((f) => f.name === r));
    if (missing.length > 0) {
      setImportError(`Faltan archivos requeridos: ${missing.join(", ")}`);
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    const filename = `SR_Import_${new Date().toISOString().slice(0,10)}`;
    const fileMap = new Map(files.map((f) => [f.name, f]));

    const result: any = {
      catalogs: {},
      sales: null,
      turnos: null,
    };

    try {
      // FASE 1: Catálogos (orden importante: grupos → productos → meseros)
      if (fileMap.has("grupos.xml")) {
        log("📚 Importando grupos...");
        const r = await importGrupos({
          businessId: selectedBusiness,
          xml: fileMap.get("grupos.xml")!.content,
          filename: `${filename}_grupos`,
        });
        result.catalogs.grupos = r;
        log(`  ✓ ${r.success}/${r.totalGrupos} grupos`);
      }

      if (fileMap.has("productos.xml")) {
        log("📦 Importando productos...");
        const r = await importProductos({
          businessId: selectedBusiness,
          productosXml: fileMap.get("productos.xml")!.content,
          gruposXml: fileMap.get("grupos.xml")?.content,
          filename: `${filename}_productos`,
        });
        result.catalogs.productos = r;
        log(`  ✓ ${r.created} creados, ${r.updated} actualizados de ${r.totalProductos}`);
      }

      if (fileMap.has("meseros.xml")) {
        log("👥 Importando meseros...");
        const r = await importMeseros({
          businessId: selectedBusiness,
          xml: fileMap.get("meseros.xml")!.content,
          filename: `${filename}_meseros`,
        });
        result.catalogs.meseros = r;
        log(`  ✓ ${r.success}/${r.totalMeseros} meseros`);
      }

      // FASE 2: Ventas (cheques + cheqdet + pagos + cancela en una pasada)
      log("💰 Importando ventas (cheques + líneas + pagos)...");
      const sales = await importVentasCompletas({
        businessId: selectedBusiness,
        chequesXml: fileMap.get("cheques.xml")!.content,
        cheqdetXml: fileMap.get("cheqdet.xml")!.content,
        chequespagosXml: fileMap.get("chequespagos.xml")?.content,
        cancelaXml: fileMap.get("cancela.xml")?.content,
        filename: `${filename}_ventas`,
      });
      result.sales = sales;
      log(`  ✓ ${sales.salesCreated} ventas creadas`);
      log(`  ↻ ${sales.salesSkipped} duplicados saltados`);
      log(`  📊 ${sales.totalLines} líneas, ${sales.totalPagosCreated} pagos`);
      if (sales.phantomsCreated > 0) {
        log(`  ⚠ ${sales.phantomsCreated} productos fantasma creados (revisa catálogo)`);
      }
      if (sales.canceledMarked > 0) {
        log(`  ✗ ${sales.canceledMarked} ventas marcadas como canceladas`);
      }

      // FASE 3: Turnos
      if (fileMap.has("turnos.xml")) {
        log("🕐 Importando turnos...");
        const r = await importTurnos({
          businessId: selectedBusiness,
          xml: fileMap.get("turnos.xml")!.content,
          filename: `${filename}_turnos`,
        });
        result.turnos = r;
        log(`  ✓ ${r.success}/${r.totalTurnos} turnos`);
      }

      log("✅ Importación completa");
      setImportResult(result);
    } catch (e: any) {
      log(`❌ Error: ${e.message}`);
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────

  async function doReset() {
    if (resetConfirmText !== "BORRAR VENTAS") {
      setImportError("Texto de confirmación incorrecto");
      return;
    }
    if (!selectedBusiness) return;
    setImporting(true);
    setImportError(null);
    try {
      log(`🗑️ Reseteando ventas del negocio...`);
      const r = await resetBusinessSales({
        businessId: selectedBusiness,
        confirmText: resetConfirmText,
      });
      log(`✓ Borradas ${r.salesDeleted} ventas y ${r.linesDeleted} líneas de ${r.businessName}`);
      log(`  Monto total que se borró: $${r.totalAmountDeleted.toLocaleString("es-MX")}`);
      setResetDialog(false);
      setResetConfirmText("");
    } catch (e: any) {
      setImportError(e.message);
      log(`❌ ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  const requiredOK = files.some(f => f.name === "cheques.xml") &&
                     files.some(f => f.name === "cheqdet.xml");

  return (
    <div className="space-y-4">
      {/* Selector de negocio */}
      <Card>
        <CardHeader>
          <CardTitle>1. Negocio destino</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Importar las ventas hacia:</Label>
          <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
            <SelectTrigger className="w-full sm:w-[400px]">
              <SelectValue placeholder="Selecciona negocio" />
            </SelectTrigger>
            <SelectContent>
              {props.businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBusiness && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 hover:bg-red-50 border-red-300"
                onClick={() => setResetDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Borrar ventas existentes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drop zone */}
      <Card>
        <CardHeader>
          <CardTitle>2. Sube archivos XML o ZIP</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <Upload className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-600 mb-2">
              Arrastra el ZIP de respaldo (VENTAS.zip) o los XML individuales
            </p>
            <p className="text-xs text-slate-500 mb-4">
              También puedes subir un ZIP con catálogos (TA_CATALOGOS.zip) para enriquecer productos
            </p>
            <Input
              type="file"
              accept=".zip,.xml"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="max-w-xs mx-auto"
            />
            {extracting && (
              <p className="text-sm text-blue-600 mt-3">
                <Loader2 className="h-4 w-4 inline animate-spin mr-1" />
                Extrayendo...
              </p>
            )}
          </div>

          {/* Lista de archivos extraídos */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Archivos cargados ({files.length})</h4>
                <Button size="sm" variant="ghost" onClick={clearFiles}>
                  <X className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(FILE_IDENTITY).map(([name, info]) => {
                  const file = files.find((f) => f.name === name);
                  const Icon = info.icon;
                  return (
                    <div
                      key={name}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        file ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 opacity-60"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${file ? "text-emerald-600" : "text-slate-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-slate-500">{info.description}</div>
                      </div>
                      {info.required && !file && (
                        <Badge variant="outline" className="text-red-600 border-red-300">requerido</Badge>
                      )}
                      {file && (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                          {(file.size / 1024).toFixed(1)}KB
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run import */}
      <Card>
        <CardHeader>
          <CardTitle>3. Ejecutar importación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runImport}
              disabled={!requiredOK || importing || extracting || !selectedBusiness}
              size="lg"
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><Database className="h-4 w-4 mr-2" /> Importar todo</>
              )}
            </Button>
            {!requiredOK && (
              <span className="text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Mínimo necesitas cheques.xml y cheqdet.xml
              </span>
            )}
          </div>

          {/* Error */}
          {importError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {importError}
            </div>
          )}

          {/* Log */}
          {importLog.length > 0 && (
            <div className="rounded-md border bg-slate-900 p-3 text-xs font-mono text-slate-100 max-h-80 overflow-auto">
              {importLog.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">{l}</div>
              ))}
            </div>
          )}

          {/* Result summary */}
          {importResult && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <h4 className="font-semibold text-emerald-900">
                <CheckCircle2 className="h-5 w-5 inline mr-1" />
                Importación exitosa
              </h4>
              {importResult.catalogs?.productos && (
                <p className="text-sm">
                  📦 Productos: <strong>{importResult.catalogs.productos.created}</strong> creados,{" "}
                  <strong>{importResult.catalogs.productos.updated}</strong> actualizados
                </p>
              )}
              {importResult.sales && (
                <>
                  <p className="text-sm">
                    💰 Ventas: <strong>{importResult.sales.salesCreated}</strong> creadas
                    {importResult.sales.salesSkipped > 0 && (
                      <> ({importResult.sales.salesSkipped} duplicados saltados)</>
                    )}
                  </p>
                  <p className="text-sm">
                    📊 Líneas: <strong>{importResult.sales.totalLines}</strong> ·{" "}
                    Pagos: <strong>{importResult.sales.totalPagosCreated}</strong>
                  </p>
                  {importResult.sales.phantomsCreated > 0 && (
                    <p className="text-sm text-amber-700">
                      ⚠ {importResult.sales.phantomsCreated} productos sin catálogo (revisar después)
                    </p>
                  )}
                </>
              )}
              {importResult.turnos && (
                <p className="text-sm">
                  🕐 Turnos: <strong>{importResult.turnos.success}</strong>
                </p>
              )}
              <div className="pt-2 flex gap-2">
                <Button size="sm" onClick={() => router.push("/app/manager/ops")}>
                  Ver dashboard
                </Button>
                <Button size="sm" variant="outline" onClick={clearFiles}>
                  Importar otro
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">⚠️ Borrar ventas del negocio</DialogTitle>
            <DialogDescription>
              Esta acción borrará <strong>todas las ventas, líneas y pagos</strong> del negocio seleccionado.
              No se puede deshacer. Para confirmar, escribe <code className="bg-slate-100 px-1 rounded">BORRAR VENTAS</code> abajo.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Escribe: BORRAR VENTAS"
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialog(false); setResetConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== "BORRAR VENTAS" || importing}
              onClick={doReset}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Borrar ventas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

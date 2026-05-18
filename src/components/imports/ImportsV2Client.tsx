"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, CheckCircle2, AlertCircle, Loader2,
  Trash2, AlertTriangle, FileText, Database, Users, Package,
  Receipt, CreditCard, Calendar, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  parseXmlFile, slimCheque, slimCheqdet, slimChequePago,
  type ChequeJson, type CheqdetJson, type ChequePagoJson,
  type ProductoJson, type GrupoJson, type MeseroJson, type TurnoJson,
} from "@/lib/softrestaurant-client-parser";
import {
  importGruposV2, importProductosV2, importMeserosV2,
  startVentasImport, importChequesChunk, finishVentasImport,
  importTurnosV2, resetBusinessSalesV2,
} from "@/lib/import-v2.actions";

type Business = { id: string; name: string };

type ExtractedFile = {
  name: string;
  arrayBuffer: ArrayBuffer;
  size: number;
};

const FILE_IDENTITY: Record<string, { icon: any; required: boolean; description: string }> = {
  "grupos.xml":       { icon: Package,    required: false, description: "Categorías de productos" },
  "productos.xml":    { icon: Package,    required: false, description: "Catálogo de productos" },
  "meseros.xml":      { icon: Users,      required: false, description: "Lista de meseros" },
  "cheques.xml":      { icon: Receipt,    required: true,  description: "Ventas (tickets)" },
  "cheqdet.xml":      { icon: FileText,   required: true,  description: "Líneas de venta" },
  "chequespagos.xml": { icon: CreditCard, required: false, description: "Forma de pago por ticket" },
  "cancela.xml":      { icon: X,          required: false, description: "Tickets cancelados" },
  "turnos.xml":       { icon: Calendar,   required: false, description: "Cierres de caja" },
};

// Tamaño de chunk para enviar al servidor
const CHEQUES_PER_CHUNK = 100;  // 100 cheques + sus líneas + sus pagos por llamada

export default function ImportsV2Client(props: { businesses: Business[] }) {
  const router = useRouter();
  const [selectedBusiness, setSelectedBusiness] = useState<string>(props.businesses[0]?.id || "");
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
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
          log(`📦 Procesando ZIP: ${f.name}`);
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(await f.arrayBuffer());
          for (const fname of Object.keys(zip.files)) {
            const zf = zip.files[fname];
            if (zf.dir) continue;
            const lowerName = fname.split("/").pop()!.toLowerCase();
            if (FILE_IDENTITY[lowerName]) {
              const buf = await zf.async("arraybuffer");
              extracted.push({ name: lowerName, arrayBuffer: buf, size: buf.byteLength });
              log(`  ✓ ${lowerName} (${(buf.byteLength/1024).toFixed(1)} KB)`);
            }
          }
        } else if (f.name.toLowerCase().endsWith(".xml")) {
          const lowerName = f.name.toLowerCase();
          if (FILE_IDENTITY[lowerName]) {
            const buf = await f.arrayBuffer();
            extracted.push({ name: lowerName, arrayBuffer: buf, size: buf.byteLength });
            log(`✓ ${lowerName} (${(buf.byteLength/1024).toFixed(1)} KB)`);
          } else {
            log(`⚠ ${f.name}: no reconocido`);
          }
        }
      }
      const map = new Map<string, ExtractedFile>();
      for (const ef of [...files, ...extracted]) map.set(ef.name, ef);
      setFiles(Array.from(map.values()));
    } catch (e: any) {
      setImportError(`Error: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  }

  function clearFiles() {
    setFiles([]); setImportLog([]); setImportResult(null); setImportError(null);
  }

  // ── Importación ────────────────────────────────────────────
  async function runImport() {
    if (!selectedBusiness) { setImportError("Selecciona un negocio"); return; }
    const required = ["cheques.xml", "cheqdet.xml"];
    const missing = required.filter((r) => !files.some((f) => f.name === r));
    if (missing.length > 0) { setImportError(`Faltan: ${missing.join(", ")}`); return; }

    setImporting(true); setImportError(null); setImportResult(null);
    const filename = `SR_Import_${new Date().toISOString().slice(0,10)}`;
    const fileMap = new Map(files.map((f) => [f.name, f]));
    const result: any = { catalogs: {}, sales: null, turnos: null };

    try {
      // ── FASE 1: CATÁLOGOS ──
      let grupos: GrupoJson[] = [];
      if (fileMap.has("grupos.xml")) {
        log("📚 Parseando grupos.xml...");
        grupos = await parseXmlFile<GrupoJson>(fileMap.get("grupos.xml")!.arrayBuffer, "curtemp");
        log(`  ↳ ${grupos.length} grupos parseados, enviando al servidor...`);
        const r = await importGruposV2({ businessId: selectedBusiness, grupos, filename: `${filename}_grupos` });
        result.catalogs.grupos = r;
        log(`  ✓ ${r.totalGrupos} grupos importados`);
      }

      if (fileMap.has("productos.xml")) {
        log("📦 Parseando productos.xml...");
        const productos = await parseXmlFile<ProductoJson>(fileMap.get("productos.xml")!.arrayBuffer, "curtemp");
        log(`  ↳ ${productos.length} productos parseados, enviando al servidor...`);
        const r = await importProductosV2({
          businessId: selectedBusiness, productos, grupos, filename: `${filename}_productos`,
        });
        result.catalogs.productos = r;
        log(`  ✓ ${r.created} creados, ${r.updated} actualizados`);
      }

      if (fileMap.has("meseros.xml")) {
        log("👥 Parseando meseros.xml...");
        const meseros = await parseXmlFile<MeseroJson>(fileMap.get("meseros.xml")!.arrayBuffer, "curtemp");
        const r = await importMeserosV2({ businessId: selectedBusiness, meseros, filename: `${filename}_meseros` });
        result.catalogs.meseros = r;
        log(`  ✓ ${r.success}/${r.totalMeseros} meseros`);
      }

      // ── FASE 2: VENTAS POR CHUNKS ──
      log("💰 Parseando cheques.xml + cheqdet.xml + chequespagos.xml...");
      const chequesRaw = await parseXmlFile(fileMap.get("cheques.xml")!.arrayBuffer, "curcheques");
      const cheqdetRaw = await parseXmlFile(fileMap.get("cheqdet.xml")!.arrayBuffer, "curcheqdet");
      const pagosRaw = fileMap.has("chequespagos.xml")
        ? await parseXmlFile(fileMap.get("chequespagos.xml")!.arrayBuffer, "curchequespagos")
        : [];
      const cancelaRaw = fileMap.has("cancela.xml")
        ? await parseXmlFile(fileMap.get("cancela.xml")!.arrayBuffer, "curcancela")
        : [];

      const cheques = chequesRaw.map(slimCheque).filter(Boolean) as ChequeJson[];
      const cheqdet = cheqdetRaw.map(slimCheqdet).filter(Boolean) as CheqdetJson[];
      const pagos = pagosRaw.map(slimChequePago).filter(Boolean) as ChequePagoJson[];
      const canceladosFolios = cancelaRaw.map((c: any) => c.folio).filter(Boolean);

      log(`  ↳ ${cheques.length} cheques, ${cheqdet.length} líneas, ${pagos.length} pagos, ${canceladosFolios.length} cancelaciones`);

      // Indexar líneas y pagos por folio
      const cheqdetByFolio: Record<string, CheqdetJson[]> = {};
      for (const line of cheqdet) {
        if (!cheqdetByFolio[line.foliodet]) cheqdetByFolio[line.foliodet] = [];
        cheqdetByFolio[line.foliodet].push(line);
      }
      const pagosByFolio: Record<string, ChequePagoJson[]> = {};
      for (const p of pagos) {
        if (!pagosByFolio[p.folio]) pagosByFolio[p.folio] = [];
        pagosByFolio[p.folio].push(p);
      }

      // Start import (crea batch)
      log("🚀 Iniciando importación en servidor...");
      const startResult = await startVentasImport({
        businessId: selectedBusiness,
        filename: `${filename}_ventas`,
        totalCheques: cheques.length,
        totalCheqdet: cheqdet.length,
        totalPagos: pagos.length,
      });
      const batchId = startResult.batchId;
      const cashpointId = startResult.cashpointId;
      if (!cashpointId) throw new Error("No se pudo resolver el cashpoint");

      // Procesar en chunks
      const totalChunks = Math.ceil(cheques.length / CHEQUES_PER_CHUNK);
      const stats = {
        salesCreated: 0, salesSkipped: 0, salesErrors: 0,
        totalLines: 0, totalPagos: 0, phantoms: 0, canceled: 0,
      };
      setProgress({ current: 0, total: cheques.length, label: "Importando ventas..." });

      for (let i = 0; i < cheques.length; i += CHEQUES_PER_CHUNK) {
        const chunkN = Math.floor(i / CHEQUES_PER_CHUNK) + 1;
        const chunk = cheques.slice(i, i + CHEQUES_PER_CHUNK);
        const folios = new Set(chunk.map((c) => c.folio));

        // Filtrar líneas y pagos solo para este chunk
        const chunkCheqdet: Record<string, CheqdetJson[]> = {};
        const chunkPagos: Record<string, ChequePagoJson[]> = {};
        for (const folio of folios) {
          if (cheqdetByFolio[folio]) chunkCheqdet[folio] = cheqdetByFolio[folio];
          if (pagosByFolio[folio]) chunkPagos[folio] = pagosByFolio[folio];
        }
        // Cancelados de este chunk
        const chunkCancelados = canceladosFolios.filter((f) => folios.has(f));

        log(`  ⚙ Chunk ${chunkN}/${totalChunks} (${chunk.length} cheques)...`);

        const chunkResult = await importChequesChunk({
          businessId: selectedBusiness,
          batchId,
          cashpointId,
          userId: "",  // server usa session
          cheques: chunk,
          cheqdetByFolio: chunkCheqdet,
          pagosByFolio: chunkPagos,
          canceladosFolios: chunkCancelados,
        });

        stats.salesCreated += chunkResult.salesCreated;
        stats.salesSkipped += chunkResult.salesSkipped;
        stats.salesErrors += chunkResult.salesErrors;
        stats.totalLines += chunkResult.totalLines;
        stats.totalPagos += chunkResult.totalPagos;
        stats.phantoms += chunkResult.phantoms;
        stats.canceled += chunkResult.canceled;

        setProgress({
          current: Math.min(i + CHEQUES_PER_CHUNK, cheques.length),
          total: cheques.length,
          label: `Importando ventas... (${stats.salesCreated} OK, ${stats.salesSkipped} duplicados)`,
        });
      }

      log(`✅ Ventas: ${stats.salesCreated} creadas, ${stats.salesSkipped} duplicados, ${stats.salesErrors} errores`);
      log(`📊 ${stats.totalLines} líneas, ${stats.totalPagos} pagos, ${stats.phantoms} phantoms, ${stats.canceled} canceladas`);

      // Finalize
      await finishVentasImport({ batchId, finalStats: stats });
      result.sales = { batchId, ...stats };

      // ── FASE 3: TURNOS ──
      if (fileMap.has("turnos.xml")) {
        log("🕐 Importando turnos...");
        const turnos = await parseXmlFile<TurnoJson>(fileMap.get("turnos.xml")!.arrayBuffer, "curturnos");
        const r = await importTurnosV2({ businessId: selectedBusiness, turnos, filename: `${filename}_turnos` });
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
      setProgress({ current: 0, total: 0, label: "" });
    }
  }

  async function doReset() {
    if (resetConfirmText !== "BORRAR VENTAS") return;
    if (!selectedBusiness) return;
    setImporting(true); setImportError(null);
    try {
      log(`🗑️ Reseteando ventas...`);
      const r = await resetBusinessSalesV2({ businessId: selectedBusiness, confirmText: resetConfirmText });
      log(`✓ Borradas ${r.salesDeleted} ventas (${r.linesDeleted} líneas) de ${r.businessName}`);
      log(`  Monto: $${r.totalAmountDeleted.toLocaleString("es-MX")}`);
      setResetDialog(false); setResetConfirmText("");
    } catch (e: any) {
      setImportError(e.message); log(`❌ ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  const requiredOK = files.some(f => f.name === "cheques.xml") &&
                     files.some(f => f.name === "cheqdet.xml");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>1. Negocio destino</CardTitle></CardHeader>
        <CardContent>
          <Label>Importar las ventas hacia:</Label>
          <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
            <SelectTrigger className="w-full sm:w-[400px]"><SelectValue placeholder="Selecciona negocio" /></SelectTrigger>
            <SelectContent>
              {props.businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBusiness && (
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm"
                className="text-red-700 hover:bg-red-50 border-red-300"
                onClick={() => setResetDialog(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Borrar ventas existentes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Sube archivos XML o ZIP</CardTitle></CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
            }`}
          >
            <Upload className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-600 mb-2">
              Arrastra el ZIP de respaldo o los XML individuales
            </p>
            <Input type="file" accept=".zip,.xml" multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="max-w-xs mx-auto" />
            {extracting && (
              <p className="text-sm text-blue-600 mt-3">
                <Loader2 className="h-4 w-4 inline animate-spin mr-1" /> Extrayendo...
              </p>
            )}
          </div>

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
                    <div key={name}
                      className={`flex items-center gap-2 p-2 rounded border ${
                        file ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 opacity-60"
                      }`}>
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

      <Card>
        <CardHeader><CardTitle>3. Ejecutar importación</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runImport} disabled={!requiredOK || importing || extracting || !selectedBusiness} size="lg">
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

          {/* Progress bar */}
          {importing && progress.total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{progress.label}</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all"
                  style={{ width: `${(progress.current/progress.total)*100}%` }} />
              </div>
            </div>
          )}

          {importError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 inline mr-1" /> {importError}
            </div>
          )}

          {importLog.length > 0 && (
            <div className="rounded-md border bg-slate-900 p-3 text-xs font-mono text-slate-100 max-h-80 overflow-auto">
              {importLog.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">{l}</div>
              ))}
            </div>
          )}

          {importResult && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <h4 className="font-semibold text-emerald-900">
                <CheckCircle2 className="h-5 w-5 inline mr-1" /> Importación exitosa
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
                    Pagos: <strong>{importResult.sales.totalPagos}</strong>
                  </p>
                  {importResult.sales.phantoms > 0 && (
                    <p className="text-sm text-amber-700">
                      ⚠ {importResult.sales.phantoms} productos sin catálogo
                    </p>
                  )}
                </>
              )}
              {importResult.turnos && (
                <p className="text-sm">🕐 Turnos: <strong>{importResult.turnos.success}</strong></p>
              )}
              <div className="pt-2 flex gap-2">
                <Button size="sm" onClick={() => router.push("/app/manager/ops")}>Ver dashboard</Button>
                <Button size="sm" variant="outline" onClick={clearFiles}>Importar otro</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">⚠️ Borrar ventas del negocio</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 mb-2">
            Esta acción borra <strong>todas las ventas, líneas y pagos</strong> del negocio.
            Escribe <code className="bg-slate-100 px-1 rounded">BORRAR VENTAS</code> para confirmar.
          </div>
          <Input value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Escribe: BORRAR VENTAS" className="font-mono" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetDialog(false); setResetConfirmText(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={resetConfirmText !== "BORRAR VENTAS" || importing} onClick={doReset}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Borrar ventas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

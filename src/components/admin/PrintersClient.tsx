"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer as PrinterIcon, Plus, X, Save, Trash2, AlertCircle, Check,
  Wifi, WifiOff, RefreshCw, Key, Copy, Eye, EyeOff,
} from "lucide-react";
import {
  createPrinter, updatePrinter, deletePrinter,
  testPrinter, regeneratePrintAgentToken,
} from "@/lib/printers.actions";
import { retryPrintJob } from "@/lib/print.actions";

type Printer = {
  id: string;
  name: string;
  role: "KITCHEN" | "BAR" | "CASHIER" | "OTHER";
  ipAddress: string;
  port: number;
  paperWidth: number;
  isActive: boolean;
  lastSeenAt: Date | null;
};

type PrintJob = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  printedAt: Date | null;
  printer: { name: string; role: string } | null;
};

type Props = {
  businessId: string;
  businessName: string;
  printers: Printer[];
  recentJobs: PrintJob[];
  agentInfo: {
    token: string | null;
    pendingJobs: number;
    failedJobs: number;
  };
};

const ROLE_LABELS = {
  KITCHEN: "🍳 Cocina",
  BAR: "🍸 Barra",
  CASHIER: "💰 Caja",
  OTHER: "📄 Otra",
};

const STATUS_LABELS = {
  PENDING: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  PRINTING: { label: "Imprimiendo", color: "bg-blue-100 text-blue-700" },
  PRINTED: { label: "✓ Impreso", color: "bg-green-100 text-green-700" },
  FAILED: { label: "✗ Falló", color: "bg-red-100 text-red-700" },
  CANCELED: { label: "Cancelado", color: "bg-gray-100 text-gray-700" },
};

export function PrintersClient({
  businessId, businessName, printers, recentJobs, agentInfo,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Modal nuevo / editar
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({
    name: "",
    role: "CASHIER" as Printer["role"],
    ipAddress: "192.168.1.",
    port: 9100,
  });

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function openNew() {
    setForm({ name: "", role: "CASHIER", ipAddress: "192.168.1.", port: 9100 });
    setEditingId("new");
  }

  function openEdit(p: Printer) {
    setForm({
      name: p.name,
      role: p.role,
      ipAddress: p.ipAddress,
      port: p.port,
    });
    setEditingId(p.id);
  }

  function handleSave() {
    start(async () => {
      try {
        if (editingId === "new") {
          await createPrinter({ businessId, ...form });
          showSuccess("Impresora creada");
        } else if (editingId) {
          await updatePrinter({ id: editingId, ...form });
          showSuccess("Impresora actualizada");
        }
        setEditingId(null);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la impresora "${name}"?`)) return;
    start(async () => {
      try {
        await deletePrinter(id);
        showSuccess("Impresora eliminada");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleTest(id: string, name: string) {
    start(async () => {
      try {
        await testPrinter(id);
        showSuccess(`Prueba enviada a ${name}. Si está bien configurada, imprimirá en unos segundos.`);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleRetry(jobId: string) {
    start(async () => {
      try {
        await retryPrintJob(jobId);
        showSuccess("Trabajo re-encolado");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleRegenerateToken() {
    if (!confirm("⚠️ ¿Regenerar el token? El Print Agent actual dejará de funcionar hasta que actualices su configuración con el nuevo token.")) return;
    start(async () => {
      try {
        await regeneratePrintAgentToken(businessId);
        showSuccess("Token regenerado. Copia el nuevo y configúralo en el Print Agent.");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function copyToken() {
    if (!agentInfo.token) return;
    navigator.clipboard.writeText(agentInfo.token);
    showSuccess("Token copiado al portapapeles");
  }

  function copyAgentConfig() {
    const config = `# .env del Print Agent\nAPI_URL=https://app.optcaminodepiedra.com\nAGENT_TOKEN=${agentInfo.token}\nPOLL_INTERVAL_MS=3000\n`;
    navigator.clipboard.writeText(config);
    showSuccess("Configuración copiada");
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Print Agent config ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" /> Print Agent — Configuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            El Print Agent es un pequeño servicio que corre en una computadora de tu restaurante
            y envía los tickets a las impresoras. Necesitas configurarlo con este token:
          </p>

          <div className="flex gap-2 items-stretch">
            <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono break-all">
              {showToken ? agentInfo.token ?? "—" : "•".repeat(36)}
            </code>
            <Button size="sm" variant="outline" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={copyToken} disabled={!agentInfo.token}>
              <Copy className="w-4 h-4 mr-1" /> Token
            </Button>
            <Button size="sm" variant="outline" onClick={copyAgentConfig} disabled={!agentInfo.token}>
              <Copy className="w-4 h-4 mr-1" /> .env
            </Button>
          </div>

          <div className="flex gap-2 text-xs">
            <Badge variant={agentInfo.pendingJobs > 0 ? "default" : "outline"}>
              {agentInfo.pendingJobs} pendientes
            </Badge>
            <Badge variant={agentInfo.failedJobs > 0 ? "destructive" : "outline"}>
              {agentInfo.failedJobs} fallidos
            </Badge>
            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={handleRegenerateToken}>
              <RefreshCw className="w-3 h-3 mr-1" /> Regenerar token
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Impresoras configuradas ────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <PrinterIcon className="w-4 h-4" /> Impresoras
            </CardTitle>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {printers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay impresoras configuradas.
            </p>
          ) : (
            <div className="divide-y">
              {printers.map((p) => {
                const isOnline = p.lastSeenAt &&
                  Date.now() - new Date(p.lastSeenAt).getTime() < 60_000;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3">
                    <div>
                      {isOnline ? (
                        <Wifi className="w-5 h-5 text-green-600" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{p.name}</p>
                        <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[p.role]}</Badge>
                        {!p.isActive && (
                          <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <code>{p.ipAddress}:{p.port}</code>
                        {p.lastSeenAt && (
                          <> · Última conexión: {new Date(p.lastSeenAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</>
                        )}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleTest(p.id, p.name)} disabled={pending}>
                      Probar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} disabled={pending}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(p.id, p.name)} disabled={pending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Trabajos recientes ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Trabajos recientes
            <span className="text-xs font-normal text-muted-foreground">(últimos 50)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin trabajos de impresión todavía.
            </p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {recentJobs.map((j) => {
                const status = STATUS_LABELS[j.status as keyof typeof STATUS_LABELS] ?? STATUS_LABELS.PENDING;
                return (
                  <div key={j.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
                        <Badge variant="outline" className="text-[10px]">{j.type}</Badge>
                        {j.printer && (
                          <span className="text-xs text-muted-foreground">→ {j.printer.name}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(j.createdAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                        {j.attempts > 0 && <> · {j.attempts} intento{j.attempts !== 1 ? "s" : ""}</>}
                      </p>
                      {j.lastError && (
                        <p className="text-xs text-red-600 mt-0.5 italic">{j.lastError}</p>
                      )}
                    </div>
                    {j.status === "FAILED" && (
                      <Button size="sm" variant="outline" onClick={() => handleRetry(j.id)} disabled={pending}>
                        Reintentar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal nuevo/editar ─────────────────────────────── */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">
                {editingId === "new" ? "Nueva impresora" : "Editar impresora"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground">Nombre</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Impresora Cocina"
                  className="w-full h-9 px-3 mt-1 border rounded bg-background"
                />
              </div>

              <div>
                <label className="text-xs uppercase text-muted-foreground">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                  className="w-full h-9 px-3 mt-1 border rounded bg-background"
                >
                  <option value="KITCHEN">🍳 Cocina</option>
                  <option value="BAR">🍸 Barra</option>
                  <option value="CASHIER">💰 Caja</option>
                  <option value="OTHER">📄 Otra</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase text-muted-foreground">Dirección IP</label>
                <input
                  type="text" value={form.ipAddress}
                  onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full h-9 px-3 mt-1 border rounded bg-background font-mono"
                />
              </div>

              <div>
                <label className="text-xs uppercase text-muted-foreground">Puerto</label>
                <input
                  type="number" value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9100 })}
                  className="w-full h-9 px-3 mt-1 border rounded bg-background"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Usar 9100 para impresoras Epson/Holyhah estándar
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={pending || !form.name || !form.ipAddress}>
                  <Save className="w-4 h-4 mr-1" /> Guardar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

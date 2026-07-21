"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Cable,
  Check,
  Clock3,
  Copy,
  Database,
  FileSpreadsheet,
  KeyRound,
  Laptop,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createIntegrationConnector,
  deleteIntegrationConnector,
  regenerateIntegrationAgentToken,
  setIntegrationConnectorActive,
  type IntegrationSourceInput,
} from "@/lib/integrations.actions";

type BusinessOption = { id: string; name: string };

type RunData = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  recordsRead: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errorSummary: string | null;
};

type ConnectorData = {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  source: IntegrationSourceInput;
  status: "SETUP_REQUIRED" | "ACTIVE" | "PAUSED" | "ERROR";
  isActive: boolean;
  agentTokenPrefix: string | null;
  config: Record<string, unknown>;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdByName: string | null;
  createdAt: string;
  lastRun: RunData | null;
};

type Props = {
  businesses: BusinessOption[];
  connectors: ConnectorData[];
};

const SOURCE_LABELS: Record<IntegrationSourceInput, string> = {
  SOFTRESTAURANT: "SoftRestaurant",
  GOOGLE_SHEETS_HOTEL: "Google Sheets · Hotel",
};

const STATUS_META = {
  SETUP_REQUIRED: { label: "Falta configurar", className: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Activa", className: "bg-green-100 text-green-800" },
  PAUSED: { label: "Pausada", className: "bg-slate-100 text-slate-700" },
  ERROR: { label: "Con error", className: "bg-red-100 text-red-800" },
};

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 3 * 60 * 1000;
}

export function IntegrationsClient({ businesses, connectors }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessId: businesses[0]?.id ?? "",
    name: "",
    source: "SOFTRESTAURANT" as IntegrationSourceInput,
    spreadsheetId: "",
    sheetName: "Reservaciones",
    range: "A:Z",
    syncEveryMinutes: 5,
  });

  const metrics = useMemo(() => {
    const online = connectors.filter((c) => c.source === "SOFTRESTAURANT" && isOnline(c.lastSeenAt)).length;
    return {
      total: connectors.length,
      active: connectors.filter((c) => c.isActive && c.status === "ACTIVE").length,
      online,
      errors: connectors.filter((c) => c.status === "ERROR" || c.lastError).length,
    };
  }, [connectors]);

  function notifySuccess(message: string) {
    setSuccess(message);
    setError(null);
    window.setTimeout(() => setSuccess(null), 4000);
  }

  function copyText(text: string, message: string) {
    navigator.clipboard.writeText(text);
    notifySuccess(message);
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        setError(null);
        const result = await createIntegrationConnector(form);
        setCreateOpen(false);
        setForm((prev) => ({ ...prev, name: "", spreadsheetId: "" }));
        if (result.token) {
          setGeneratedToken(result.token);
          setTokenOpen(true);
        } else {
          notifySuccess("Conexión creada. En la siguiente fase configuraremos el acceso a Google Sheets.");
        }
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "No se pudo crear la conexión.");
      }
    });
  }

  function handleToggle(connector: ConnectorData) {
    startTransition(async () => {
      try {
        await setIntegrationConnectorActive(connector.id, !connector.isActive);
        notifySuccess(connector.isActive ? "Integración pausada." : "Integración activada.");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "No se pudo actualizar la integración.");
      }
    });
  }

  function handleRegenerate(connector: ConnectorData) {
    if (!confirm(`¿Regenerar el token de "${connector.name}"? El agente anterior dejará de conectarse.`)) return;
    startTransition(async () => {
      try {
        const result = await regenerateIntegrationAgentToken(connector.id);
        setGeneratedToken(result.token);
        setTokenOpen(true);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "No se pudo regenerar el token.");
      }
    });
  }

  function handleDelete(connector: ConnectorData) {
    if (!confirm(`¿Eliminar la integración "${connector.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteIntegrationConnector(connector.id);
        notifySuccess("Integración eliminada.");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "No se pudo eliminar la integración.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <Check className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={<Cable className="h-4 w-4" />} label="Conexiones" value={metrics.total} />
        <MetricCard icon={<Play className="h-4 w-4" />} label="Activas" value={metrics.active} />
        <MetricCard icon={<Wifi className="h-4 w-4" />} label="Agentes en línea" value={metrics.online} />
        <MetricCard icon={<AlertCircle className="h-4 w-4" />} label="Con errores" value={metrics.errors} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="h-4 w-4 text-blue-600" /> Restaurantes · SoftRestaurant
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Un agente pequeño se instalará en cada computadora y enviará ventas nuevas, cambios y cancelaciones.</p>
            <p>La computadora podrá quedarse sin internet: el agente guardará una cola local y reintentará.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Hoteles · Google Sheets
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>OPT leerá periódicamente las hojas de reservaciones y detectará filas nuevas o modificadas.</p>
            <p>La sincronización inicial será de solo lectura: Sheets → OPT, sin alterar las hojas.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" /> Conexiones configuradas
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Esta fase prepara el control, tokens y monitoreo. La importación automática se habilita en las siguientes entregas.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva conexión
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {connectors.length === 0 ? (
            <div className="py-10 text-center">
              <Cable className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <p className="font-medium">Todavía no hay conexiones</p>
              <p className="mt-1 text-sm text-muted-foreground">Crea una por cada computadora de SoftRestaurant y una por cada hoja hotelera.</p>
            </div>
          ) : (
            <div className="divide-y">
              {connectors.map((connector) => {
                const online = connector.source === "SOFTRESTAURANT" && isOnline(connector.lastSeenAt);
                const status = STATUS_META[connector.status];
                const sheetConfig = connector.config || {};
                return (
                  <div key={connector.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2.5">
                        {connector.source === "SOFTRESTAURANT" ? (
                          online ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{connector.name}</p>
                          <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[connector.source]}</Badge>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>{status.label}</span>
                          {online && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">En línea</span>}
                        </div>

                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" /> {connector.businessName}
                        </p>

                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                          <Info label="Última conexión" value={formatDate(connector.lastSeenAt)} />
                          <Info label="Última sincronización" value={formatDate(connector.lastSyncAt)} />
                          <Info label="Último éxito" value={formatDate(connector.lastSuccessAt)} />
                          <Info
                            label={connector.source === "SOFTRESTAURANT" ? "Token" : "Hoja"}
                            value={connector.source === "SOFTRESTAURANT"
                              ? connector.agentTokenPrefix || "Sin token"
                              : String(sheetConfig.sheetName || "Sin definir")}
                          />
                        </div>

                        {connector.source === "GOOGLE_SHEETS_HOTEL" && sheetConfig.spreadsheetId ? (
                          <p className="mt-2 truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                            ID: {String(sheetConfig.spreadsheetId)} · Rango: {String(sheetConfig.range || "A:Z")}
                          </p>
                        ) : null}

                        {connector.lastError && (
                          <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            {connector.lastError}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={pending}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggle(connector)}>
                            {connector.isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                            {connector.isActive ? "Pausar" : "Activar"}
                          </DropdownMenuItem>
                          {connector.source === "SOFTRESTAURANT" && (
                            <DropdownMenuItem onClick={() => handleRegenerate(connector)}>
                              <RefreshCw className="mr-2 h-4 w-4" /> Regenerar token
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(connector)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva conexión</DialogTitle>
            <DialogDescription>
              Crea una conexión por computadora de SoftRestaurant o por hoja principal de hotel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.source} onValueChange={(value) => setForm({ ...form, source: value as IntegrationSourceInput })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOFTRESTAURANT">SoftRestaurant · computadora local</SelectItem>
                  <SelectItem value="GOOGLE_SHEETS_HOTEL">Google Sheets · hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select value={form.businessId} onValueChange={(value) => setForm({ ...form, businessId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un negocio" /></SelectTrigger>
                <SelectContent>
                  {businesses.map((business) => <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="integration-name">Nombre de la conexión</Label>
              <Input
                id="integration-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={form.source === "SOFTRESTAURANT" ? "PC Caja Bodega 4" : "Reservaciones Camino de Piedra"}
              />
            </div>

            {form.source === "GOOGLE_SHEETS_HOTEL" && (
              <div className="space-y-4 rounded-lg border p-3">
                <div className="space-y-2">
                  <Label htmlFor="spreadsheet-id">Enlace o ID del Google Sheet</Label>
                  <Input
                    id="spreadsheet-id"
                    value={form.spreadsheetId}
                    onChange={(event) => setForm({ ...form, spreadsheetId: event.target.value })}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sheet-name">Pestaña</Label>
                    <Input id="sheet-name" value={form.sheetName} onChange={(event) => setForm({ ...form, sheetName: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheet-range">Rango</Label>
                    <Input id="sheet-range" value={form.range} onChange={(event) => setForm({ ...form, range: event.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Todavía no leerá datos. Primero revisaremos las columnas reales y definiremos el mapeo.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={pending || !form.businessId || form.name.trim().length < 3}>
              {pending ? "Creando..." : "Crear conexión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tokenOpen} onOpenChange={setTokenOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Token del agente</DialogTitle>
            <DialogDescription>
              Este token se muestra una sola vez. Guárdalo para instalar el agente en la computadora del negocio.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted p-3">
            <code className="block break-all text-xs">{generatedToken}</code>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No lo compartas por WhatsApp ni lo dejes visible. Si se pierde, podrás regenerarlo desde el menú de la conexión.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => copyText(generatedToken, "Token copiado.")}>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar token
            </Button>
            <Button onClick={() => setTokenOpen(false)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-0.5 truncate">{value}</p>
    </div>
  );
}

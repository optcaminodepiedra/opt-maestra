"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, Package, Clock, Receipt, Percent,
  GitCompare, ShieldCheck, FileDown, Printer, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import TopProductsTab from "./tabs/TopProductsTab";
import CategoriesTab from "./tabs/CategoriesTab";
import TemporalTab from "./tabs/TemporalTab";
import TicketsTab from "./tabs/TicketsTab";
import DiscountsTab from "./tabs/DiscountsTab";
import CompareTab from "./tabs/CompareTab";
import CatalogHealthTab from "./tabs/CatalogHealthTab";

import { getAvailableGroups } from "@/lib/products-analytics";

type Business = { id: string; name: string };

export default function ProductsReportClient(props: {
  businesses: Business[];
  defaultBusinessId: string;
  defaultTab: string;
  defaultFrom?: string;
  defaultTo?: string;
  scopeIsGlobal: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [businessId, setBusinessId] = useState(props.defaultBusinessId);
  const [fromDate, setFromDate] = useState(props.defaultFrom || thirtyDaysAgo);
  const [toDate, setToDate] = useState(props.defaultTo || today);
  const [groupCode, setGroupCode] = useState<string>("all");
  const [tab, setTab] = useState(props.defaultTab);
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const [groups, setGroups] = useState<{ code: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    setLoadingGroups(true);
    getAvailableGroups(businessId)
      .then(setGroups)
      .finally(() => setLoadingGroups(false));
  }, [businessId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (businessId) params.set("businessId", businessId);
    params.set("from", fromDate);
    params.set("to", toDate);
    params.set("tab", tab);
    router.replace(`/app/manager/ops/products-report?${params.toString()}`, { scroll: false });
  }, [businessId, fromDate, toDate, tab, router]);

  const filters = {
    businessId,
    fromDate,
    toDate,
    groupCode: groupCode === "all" ? undefined : groupCode,
    includeCanceled,
  };

  const applyPreset = (preset: "7d" | "30d" | "90d" | "ytd" | "all") => {
    const now = new Date();
    const t = now.toISOString().slice(0, 10);
    setToDate(t);
    if (preset === "7d") setFromDate(new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
    else if (preset === "30d") setFromDate(new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10));
    else if (preset === "90d") setFromDate(new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10));
    else if (preset === "ytd") setFromDate(`${now.getFullYear()}-01-01`);
    else if (preset === "all") setFromDate("2020-01-01");
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams({
      businessId: businessId || "",
      from: fromDate,
      to: toDate,
      ...(filters.groupCode ? { group: filters.groupCode } : {}),
    });
    window.open(`/api/reports/products/export?${params.toString()}`, "_blank");
  };

  const handlePrint = () => {
    // Activar todos los tabs antes de imprimir (carga sus datos)
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      // Dejar print mode activo unos segundos para que termine la impresión
      setTimeout(() => setPrintMode(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* Estilos de impresión para PDF limpio */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 12mm 10mm; }
          aside, nav, header[role="banner"], .app-sidebar, .app-header { display: none !important; }
          body, html { background: white !important; font-size: 11px; }
          [role="tabpanel"][hidden] { display: block !important; }
          [role="tabpanel"] { page-break-inside: avoid; page-break-before: auto; margin-bottom: 16px; }
          .card, [class*="rounded-lg"] { box-shadow: none !important; border: 1px solid #ddd !important; }
          table { page-break-inside: auto; font-size: 10px; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .recharts-wrapper { page-break-inside: avoid; }
          .print-header { display: block !important; margin-bottom: 8px; font-size: 10px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        }
        .print-header { display: none; }
      ` }} />

      {/* Encabezado solo visible al imprimir */}
      <div className="print-header">
        Reporte de productos · {fromDate} a {toDate}
        {props.businesses.find(b => b.id === businessId)?.name && (
          <> · {props.businesses.find(b => b.id === businessId)?.name}</>
        )}
      </div>

      <Card className="p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs text-slate-600">Negocio</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {props.businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Desde</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Hasta</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={today} />
          </div>
          <div>
            <Label className="text-xs text-slate-600">
              Categoría {loadingGroups && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}
            </Label>
            <Select value={groupCode} onValueChange={setGroupCode}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => applyPreset("7d")}>7 días</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("30d")}>30 días</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("90d")}>90 días</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("ytd")}>Año</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("all")}>Todo</Button>
            <label className="flex items-center gap-1 ml-2 cursor-pointer text-xs">
              <input type="checkbox" checked={includeCanceled}
                onChange={(e) => setIncludeCanceled(e.target.checked)} />
              Incluir canceladas
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportExcel}>
              <FileDown className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto print:hidden">
          <TabsTrigger value="top"><TrendingUp className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Productos</span></TabsTrigger>
          <TabsTrigger value="categories"><Package className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Categorías</span></TabsTrigger>
          <TabsTrigger value="temporal"><Clock className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Temporal</span></TabsTrigger>
          <TabsTrigger value="tickets"><Receipt className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Tickets</span></TabsTrigger>
          <TabsTrigger value="discounts"><Percent className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Descuentos</span></TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Comparar</span></TabsTrigger>
          <TabsTrigger value="health"><ShieldCheck className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Catálogo</span></TabsTrigger>
        </TabsList>

        {/* forceMount cuando printMode: monta todos los tabs para impresión */}
        <TabsContent value="top" forceMount={printMode || undefined}><TopProductsTab filters={filters} /></TabsContent>
        <TabsContent value="categories" forceMount={printMode || undefined}><CategoriesTab filters={filters} /></TabsContent>
        <TabsContent value="temporal" forceMount={printMode || undefined}><TemporalTab filters={filters} /></TabsContent>
        <TabsContent value="tickets" forceMount={printMode || undefined}><TicketsTab filters={filters} /></TabsContent>
        <TabsContent value="discounts" forceMount={printMode || undefined}><DiscountsTab filters={filters} /></TabsContent>
        {/* Compare tab solo si se usó manualmente (requiere selección) */}
        <TabsContent value="compare"><CompareTab filters={filters} /></TabsContent>
        <TabsContent value="health" forceMount={printMode || undefined}><CatalogHealthTab filters={filters} /></TabsContent>
      </Tabs>
    </div>
  );
}

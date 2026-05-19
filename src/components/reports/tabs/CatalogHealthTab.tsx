"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertCircle, Ghost, DollarSign, Copy } from "lucide-react";
import { getCatalogHealth } from "@/lib/products-analytics";
import type { ReportFilters } from "@/lib/products-analytics";

type Data = {
  phantomsCount: number;
  phantoms: { id: string; externalCode: string | null; name: string; priceCents: number }[];
  noPriceCount: number;
  noPriced: { id: string; externalCode: string | null; name: string; groupName: string | null }[];
  duplicateNames: { name: string; count: number }[];
};

export default function CatalogHealthTab(props: { filters: ReportFilters }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.filters.businessId) return;
    setLoading(true);
    getCatalogHealth(props.filters)
      .then(d => setData(d as Data))
      .finally(() => setLoading(false));
  }, [props.filters.businessId]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  if (!data) return null;

  const hasIssues = data.phantomsCount > 0 || data.noPriceCount > 0 || data.duplicateNames.length > 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={`p-3 ${data.phantomsCount > 0 ? "border-amber-300" : ""}`}>
          <div className="flex items-center gap-2 mb-1">
            <Ghost className="h-4 w-4 text-amber-600" />
            <div className="text-xs text-slate-500">Productos fantasma</div>
          </div>
          <div className="text-2xl font-semibold">{data.phantomsCount}</div>
          <div className="text-xs text-slate-500">Vendidos pero sin catálogo</div>
        </Card>
        <Card className={`p-3 ${data.noPriceCount > 0 ? "border-amber-300" : ""}`}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <div className="text-xs text-slate-500">Sin precio</div>
          </div>
          <div className="text-2xl font-semibold">{data.noPriceCount}</div>
          <div className="text-xs text-slate-500">Catálogo con precio = 0</div>
        </Card>
        <Card className={`p-3 ${data.duplicateNames.length > 0 ? "border-amber-300" : ""}`}>
          <div className="flex items-center gap-2 mb-1">
            <Copy className="h-4 w-4 text-amber-600" />
            <div className="text-xs text-slate-500">Nombres duplicados</div>
          </div>
          <div className="text-2xl font-semibold">{data.duplicateNames.length}</div>
          <div className="text-xs text-slate-500">Mismo nombre, distinto código</div>
        </Card>
      </div>

      {!hasIssues && (
        <Card className="p-8 text-center border-emerald-300 bg-emerald-50">
          <ShieldCheck className="h-10 w-10 mx-auto text-emerald-600 mb-2" />
          <p className="font-semibold text-emerald-900">Catálogo saludable</p>
          <p className="text-sm text-slate-600 mt-1">No se detectaron problemas en el catálogo.</p>
        </Card>
      )}

      {/* Phantoms */}
      {data.phantomsCount > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold flex items-center mb-2">
            <Ghost className="h-5 w-5 mr-2 text-amber-600" /> Productos fantasma ({data.phantomsCount})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Estos productos se vendieron pero no estaban en el catálogo al momento del import.
            Edita su nombre/categoría en <span className="font-mono text-xs bg-slate-100 px-1 rounded">Menú</span> después.
          </p>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Código</th>
                  <th>Nombre actual (auto)</th>
                  <th className="text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {data.phantoms.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-1 font-mono text-xs">{p.externalCode}</td>
                    <td className="text-amber-700">{p.name}</td>
                    <td className="text-right">${(p.priceCents/100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* No price */}
      {data.noPriceCount > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold flex items-center mb-2">
            <DollarSign className="h-5 w-5 mr-2 text-amber-600" /> Productos sin precio ({data.noPriceCount})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Estos productos están en catálogo con precio = $0. Configura precio en Menú.
          </p>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Código</th>
                  <th>Nombre</th>
                  <th>Grupo</th>
                </tr>
              </thead>
              <tbody>
                {data.noPriced.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-1 font-mono text-xs">{p.externalCode}</td>
                    <td>{p.name}</td>
                    <td className="text-xs text-slate-500">{p.groupName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Duplicates */}
      {data.duplicateNames.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold flex items-center mb-2">
            <Copy className="h-5 w-5 mr-2 text-amber-600" /> Posibles duplicados ({data.duplicateNames.length})
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Productos con el mismo nombre pero diferente código. Pueden ser intencional (medidas distintas) o duplicado real.
          </p>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {data.duplicateNames.map((d, i) => (
              <div key={i} className="flex justify-between p-2 border rounded">
                <span>{d.name}</span>
                <Badge variant="outline">{d.count} copias</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

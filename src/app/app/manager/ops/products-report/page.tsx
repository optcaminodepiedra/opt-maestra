import { resolveManagerScope } from "@/lib/manager-scope";
import ProductsReportClient from "@/components/reports/ProductsReportClient";

export const dynamic = "force-dynamic";

export default async function ProductsReportPage(props: {
  searchParams: Promise<{ businessId?: string; from?: string; to?: string; tab?: string }>;
}) {
  const scope = await resolveManagerScope();
  const businesses = scope.businesses;
  const sp = await props.searchParams;
  const defaultBusinessId = sp.businessId || businesses[0]?.id || "";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes de productos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Análisis profundo de ventas, productos, categorías y patrones operativos
        </p>
      </div>

      <ProductsReportClient
        businesses={businesses.map(b => ({ id: b.id, name: b.name }))}
        defaultBusinessId={defaultBusinessId}
        defaultTab={sp.tab || "top"}
        defaultFrom={sp.from}
        defaultTo={sp.to}
        scopeIsGlobal={scope.isGlobal}
      />
    </div>
  );
}

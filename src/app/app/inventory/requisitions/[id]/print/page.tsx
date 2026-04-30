import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRequisitionById } from "@/lib/requisitions.queries";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const KIND_LABEL: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SPECIAL_EVENT: "Evento especial",
  OWNER_HOUSE: "Casa Navarro Smith",
  VENDING_MACHINE: "Máquina dispensadora",
  GENERAL: "General",
};

export default async function RequisitionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const req = await getRequisitionById(id);
  if (!req) notFound();

  const totalRequested = req.items.reduce(
    (sum: number, it: any) => sum + it.qtyRequested * it.estimatedPriceCents,
    0
  );
  const totalDelivered = req.items.reduce(
    (sum: number, it: any) => sum + (it.qtyDelivered ?? 0) * it.estimatedPriceCents,
    0
  );

  return (
    <div className="bg-white text-black min-h-screen p-8 print:p-0">
      <style>{`
        @media print {
          @page { margin: 1cm; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
        >
          Imprimir
        </button>
        <a
          href={`/app/inventory/requisitions/${id}`}
          className="px-4 py-2 border rounded hover:bg-gray-50 text-sm"
        >
          Volver
        </a>
      </div>

      {/* Encabezado */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">REQUISICIÓN DE INVENTARIO</h1>
            <p className="text-sm mt-1">OPT — Operadora Turística Camino de Piedra</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Folio</p>
            <p className="text-lg font-mono font-bold">{req.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Info principal */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs text-gray-600 uppercase">Tipo</p>
          <p className="text-sm font-semibold">
            {KIND_LABEL[req.kind] ?? req.kind}
            {req.priority === "URGENT" && (
              <span className="ml-2 text-red-600 font-bold">⚠ URGENTE</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600 uppercase">Estado</p>
          <p className="text-sm font-semibold">{req.status.replace(/_/g, " ")}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 uppercase">Negocio</p>
          <p className="text-sm font-semibold">{req.business?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 uppercase">Solicitado por</p>
          <p className="text-sm font-semibold">{req.createdBy.fullName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 uppercase">Fecha de solicitud</p>
          <p className="text-sm font-semibold">
            {new Date(req.createdAt).toLocaleDateString("es-MX", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        {req.neededBy && (
          <div>
            <p className="text-xs text-gray-600 uppercase">Necesaria para</p>
            <p className="text-sm font-semibold">
              {new Date(req.neededBy).toLocaleDateString("es-MX", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Título de requisición */}
      <div className="mb-4">
        <p className="text-xs text-gray-600 uppercase">Título</p>
        <p className="text-base font-bold">{req.title}</p>
        {req.eventName && (
          <p className="text-sm mt-1">
            <span className="text-gray-600">Evento:</span>{" "}
            <span className="font-medium">{req.eventName}</span>
          </p>
        )}
      </div>

      {req.note && (
        <div className="mb-4 p-3 border border-gray-300 bg-gray-50">
          <p className="text-xs text-gray-600 uppercase">Notas</p>
          <p className="text-sm whitespace-pre-line">{req.note}</p>
        </div>
      )}

      {/* Tabla de items */}
      <table className="w-full border-collapse text-sm mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black px-2 py-1 text-left">#</th>
            <th className="border border-black px-2 py-1 text-left">Producto</th>
            <th className="border border-black px-2 py-1 text-center">Unidad</th>
            <th className="border border-black px-2 py-1 text-center">Solicitado</th>
            <th className="border border-black px-2 py-1 text-center">Entregado</th>
            <th className="border border-black px-2 py-1 text-right">Precio Est.</th>
            <th className="border border-black px-2 py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {req.items.map((it: any, idx: number) => {
            const itemName = it.item?.name ?? it.freeTextName ?? "—";
            const unit = it.item?.unit ?? it.freeTextUnit ?? "—";
            const subtotal = it.qtyRequested * it.estimatedPriceCents;
            const partial = it.qtyDelivered != null && it.qtyDelivered < it.qtyRequested;

            return (
              <tr key={it.id} className={partial ? "bg-orange-50" : ""}>
                <td className="border border-black px-2 py-1">{idx + 1}</td>
                <td className="border border-black px-2 py-1">
                  {itemName}
                  {!it.item && (
                    <span className="text-[9px] ml-1 text-gray-500">(libre)</span>
                  )}
                  {it.note && (
                    <p className="text-[10px] italic text-gray-600 mt-0.5">{it.note}</p>
                  )}
                  {it.notDeliveredReason && (
                    <p className="text-[10px] text-orange-700 mt-0.5">
                      ⚠ {it.notDeliveredReason}
                    </p>
                  )}
                </td>
                <td className="border border-black px-2 py-1 text-center">{unit}</td>
                <td className="border border-black px-2 py-1 text-center font-bold">
                  {it.qtyRequested}
                </td>
                <td className="border border-black px-2 py-1 text-center">
                  {it.qtyDelivered != null ? (
                    <span className={partial ? "text-orange-700 font-bold" : "font-bold"}>
                      {it.qtyDelivered}
                    </span>
                  ) : (
                    <span className="inline-block w-12 border-b border-gray-400">&nbsp;</span>
                  )}
                </td>
                <td className="border border-black px-2 py-1 text-right">
                  {it.estimatedPriceCents > 0 ? fmt(it.estimatedPriceCents) : "—"}
                </td>
                <td className="border border-black px-2 py-1 text-right">
                  {fmt(subtotal)}
                </td>
              </tr>
            );
          })}

          <tr className="bg-gray-100 font-bold">
            <td colSpan={6} className="border border-black px-2 py-1 text-right">
              TOTAL SOLICITADO:
            </td>
            <td className="border border-black px-2 py-1 text-right">
              {fmt(totalRequested)}
            </td>
          </tr>
          {totalDelivered > 0 && totalDelivered !== totalRequested && (
            <tr className="bg-orange-100 font-bold">
              <td colSpan={6} className="border border-black px-2 py-1 text-right">
                TOTAL ENTREGADO REAL:
              </td>
              <td className="border border-black px-2 py-1 text-right">
                {fmt(totalDelivered)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Notas de entrega */}
      {req.deliveryNote && (
        <div className="mb-6 p-3 border border-gray-300">
          <p className="text-xs text-gray-600 uppercase">Notas de entrega</p>
          <p className="text-sm">{req.deliveryNote}</p>
        </div>
      )}

      {/* Zona de firmas */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        <div className="text-center">
          <div className="border-b-2 border-black h-16 mb-1">
            {req.deliveredBy && (
              <p className="text-xs italic pt-12">{req.deliveredBy.fullName}</p>
            )}
          </div>
          <p className="text-xs uppercase font-bold">Entrega (Almacén)</p>
          {req.deliveredBy && (
            <p className="text-[10px] text-gray-600 mt-1">{req.deliveredBy.fullName}</p>
          )}
          {req.deliveredAt && (
            <p className="text-[10px] text-gray-600">
              {new Date(req.deliveredAt).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>
        <div className="text-center">
          <div className="border-b-2 border-black h-16 mb-1">
            {req.receivedSignature && (
              <p className="text-base italic font-serif pt-10">{req.receivedSignature}</p>
            )}
          </div>
          <p className="text-xs uppercase font-bold">Recibido (Conformidad)</p>
          {req.receivedBy && (
            <p className="text-[10px] text-gray-600 mt-1">{req.receivedBy.fullName}</p>
          )}
          {req.receivedAt && (
            <p className="text-[10px] text-gray-600">
              {new Date(req.receivedAt).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>
      </div>

      {/* Pie */}
      <div className="mt-12 pt-4 border-t border-gray-300 text-center">
        <p className="text-[9px] text-gray-500">
          Documento generado por OPT Maestra · {new Date().toLocaleString("es-MX")}
        </p>
      </div>
    </div>
  );
}

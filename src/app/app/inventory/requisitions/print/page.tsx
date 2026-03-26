import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import PrintButton from "./PrintButton"; // Lo crearemos en el siguiente paso

export default async function PrintRequisitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Traemos SOLO las requisiciones que ya fueron APROBADAS (listas para comprar)
  const approvedRequisitions = await prisma.requisition.findMany({
    where: { status: "APPROVED" },
    include: {
      items: {
        include: { item: true }
      }
    }
  });

  // Aplanamos todos los items de diferentes requisiciones en una sola lista gigante
  const allItemsToBuy = approvedRequisitions.flatMap(req => req.items);

  // Agrupamos los productos iguales (ej. si cocina pidió 5 leches y café pidió 2 leches, que salga "7 leches" juntas)
  const consolidatedList = allItemsToBuy.reduce((acc, currentItem) => {
    const existing = acc.find(i => i.item.id === currentItem.item.id);
    if (existing) {
      existing.qtyRequested += currentItem.qtyRequested;
      // Sumamos el costo estimado
      existing.estimatedTotalCents += (currentItem.qtyRequested * currentItem.item.lastPriceCents);
    } else {
      acc.push({
        ...currentItem,
        estimatedTotalCents: currentItem.qtyRequested * currentItem.item.lastPriceCents
      });
    }
    return acc;
  }, [] as typeof allItemsToBuy & { estimatedTotalCents: number }[]);

  // Ordenamos por proveedor para que en el súper no andes dando vueltas
  consolidatedList.sort((a, b) => (a.item.supplierName || "").localeCompare(b.item.supplierName || ""));

  // Calculamos el total estimado
  const grandTotalCents = consolidatedList.reduce((sum, item) => sum + item.estimatedTotalCents, 0);
  const formatMoney = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-white min-h-screen">
      
      {/* CABECERA (Se oculta al imprimir) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/app/inventory/requisitions"><ArrowLeft className="w-4 h-4 mr-2" /> Volver</Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lista de Compras</h1>
            <p className="text-muted-foreground mt-1">
              Productos aprobados listos para surtir.
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* DOCUMENTO IMPRIMIBLE */}
      <div className="print:block">
        
        {/* Encabezado del Documento */}
        <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-2">
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-widest">Orden de Compra General</h2>
            <p className="text-sm text-gray-500">Generada el: {new Date().toLocaleDateString("es-MX", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase font-bold text-gray-500">Presupuesto Estimado</p>
            <p className="text-xl font-bold">{formatMoney(grandTotalCents)}</p>
          </div>
        </div>

        {consolidatedList.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg">
            No hay productos aprobados para comprar.
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="border p-3 w-10 text-center">✓</th>
                <th className="border p-3 w-24 text-center">Cant.</th>
                <th className="border p-3">Producto</th>
                <th className="border p-3 w-40">Proveedor / Lugar</th>
                <th className="border p-3 w-32 text-right">Precio Est.</th>
                <th className="border p-3 w-32 text-right">Total Est.</th>
                <th className="border p-3 w-40 text-center bg-gray-50 italic">Precio Real (Llenar)</th>
              </tr>
            </thead>
            <tbody>
              {consolidatedList.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="border p-3 text-center">
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-sm mx-auto"></div>
                  </td>
                  <td className="border p-3 text-center font-bold text-lg">
                    {item.qtyRequested} <span className="text-xs font-normal text-gray-500 uppercase">{item.item.unit}</span>
                  </td>
                  <td className="border p-3 font-semibold text-base uppercase">
                    {item.item.name}
                  </td>
                  <td className="border p-3 text-gray-600">
                    {item.item.supplierName || "—"}
                  </td>
                  <td className="border p-3 text-right text-gray-500">
                    {formatMoney(item.item.lastPriceCents)}
                  </td>
                  <td className="border p-3 text-right font-medium">
                    {formatMoney(item.estimatedTotalCents)}
                  </td>
                  <td className="border p-3 bg-gray-50/50">
                    {/* Espacio en blanco para que escriban a mano el precio nuevo */}
                    <div className="w-full border-b border-dashed border-gray-400 mt-4"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-12 pt-8 border-t flex justify-between px-12 print:flex hidden">
            <div className="text-center">
                <div className="w-48 border-b border-black mb-2"></div>
                <p className="text-xs uppercase font-bold">Firma de Recibido Almacén</p>
            </div>
            <div className="text-center">
                <div className="w-48 border-b border-black mb-2"></div>
                <p className="text-xs uppercase font-bold">Firma de Gerencia / Finanzas</p>
            </div>
        </div>

      </div>
    </div>
  );
}
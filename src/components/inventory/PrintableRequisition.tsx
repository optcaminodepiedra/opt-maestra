"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, X } from "lucide-react";
import Link from "next/link";

type ReqItem = {
  id: string;
  itemName: string;
  itemSku: string | null;
  unit: string;
  qtyRequested: number;
  qtyDelivered: number | null;
  notDeliveredReason: string | null;
  estimatedPriceCents: number;
  isFreeText: boolean;
  note: string | null;
};

type Props = {
  requisition: {
    id: string;
    title: string;
    kind: string;
    eventName: string | null;
    priority: string;
    status: string;
    note: string | null;
    urgentNote: string | null;
    requiresSeparatePayment: boolean;
    createdAt: string;
    neededBy: string | null;
    deliveredAt: string | null;
    deliveryNote: string | null;
    receivedAt: string | null;
    receivedSignature: string | null;
    businessName: string;
    createdByName: string;
    deliveredByName: string | null;
    receivedByName: string | null;
  };
  items: ReqItem[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const KIND_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SPECIAL_EVENT: "Evento especial",
  OWNER_HOUSE: "Casa Navarro Smith",
  VENDING_MACHINE: "Máquina dispensadora",
  GENERAL: "General",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ORDERED: "En compra",
  RECEIVED_PARTIAL: "Recibida parcial",
  RECEIVED: "Recibida",
  CLOSED: "Cerrada",
};

export function PrintableRequisition({ requisition, items }: Props) {
  // Auto-print al cargar (opcional, comentar si se prefiere manual)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      setTimeout(() => window.print(), 300);
    }
  }, []);

  function handlePrint() {
    window.print();
  }

  const totalRequested = items.reduce(
    (sum, it) => sum + it.qtyRequested * it.estimatedPriceCents,
    0
  );
  const totalDelivered = items.reduce((sum, it) => {
    const qty = it.qtyDelivered ?? 0;
    return sum + qty * it.estimatedPriceCents;
  }, 0);

  return (
    <>
      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          /* Ocultar todo lo que NO es la requisición impresa */
          body * {
            visibility: hidden;
          }
          .printable-area,
          .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: letter;
            margin: 1.5cm;
          }
          .page-break-avoid {
            page-break-inside: avoid;
          }
        }

        @media screen {
          .printable-area {
            max-width: 800px;
            margin: 0 auto;
            padding: 30px 40px;
            background: white;
            box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
          }
        }
      `}</style>

      {/* Barra superior (no se imprime) */}
      <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/inventory/requisitions/${requisition.id}`}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver al detalle
          </Link>
        </Button>
        <div className="text-xs text-muted-foreground">
          Vista imprimible. Usa el botón "Imprimir" o Ctrl+P
        </div>
        <Button onClick={handlePrint} size="sm">
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir
        </Button>
      </div>

      {/* Contenido imprimible */}
      <div className="printable-area">
        {/* Encabezado */}
        <div style={{ borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: "#666", marginBottom: "2px" }}>
                OPERADORA TURÍSTICA CAMINO DE PIEDRA
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0" }}>
                Requisición de productos
              </h1>
              <div style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>
                {KIND_LABELS[requisition.kind] ?? requisition.kind}
                {requisition.eventName && ` · ${requisition.eventName}`}
                {requisition.priority === "URGENT" && (
                  <span style={{ marginLeft: "8px", padding: "2px 6px", background: "#fee", color: "#c00", borderRadius: "3px", fontWeight: "bold" }}>
                    URGENTE
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px" }}>
              <div style={{ color: "#666" }}>FOLIO</div>
              <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "bold" }}>
                {requisition.id.slice(-8).toUpperCase()}
              </div>
              <div style={{ marginTop: "8px", color: "#666" }}>FECHA</div>
              <div style={{ fontSize: "12px" }}>
                {new Date(requisition.createdAt).toLocaleDateString("es-MX", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Datos generales */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", fontSize: "12px" }}>
          <div>
            <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>TÍTULO</div>
            <div style={{ fontWeight: "600" }}>{requisition.title}</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>NEGOCIO</div>
            <div>{requisition.businessName}</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>SOLICITADO POR</div>
            <div>{requisition.createdByName}</div>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>ESTADO</div>
            <div>{STATUS_LABELS[requisition.status] ?? requisition.status}</div>
          </div>
          {requisition.neededBy && (
            <div>
              <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>FECHA LÍMITE</div>
              <div>{new Date(requisition.neededBy).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          )}
          {requisition.requiresSeparatePayment && (
            <div>
              <div style={{ color: "#666", fontSize: "10px", letterSpacing: "1px", marginBottom: "2px" }}>PAGO</div>
              <div style={{ fontWeight: "600" }}>Requiere pago aparte</div>
            </div>
          )}
        </div>

        {requisition.urgentNote && (
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", padding: "8px 12px", borderRadius: "4px", marginBottom: "16px", fontSize: "11px" }}>
            <strong>Razón de urgencia:</strong> {requisition.urgentNote}
          </div>
        )}

        {requisition.note && (
          <div style={{ marginBottom: "16px", padding: "8px 12px", background: "#f9fafb", borderRadius: "4px", fontSize: "11px" }}>
            <strong>Notas:</strong> {requisition.note}
          </div>
        )}

        {/* Tabla de items */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "20px" }} className="page-break-avoid">
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>#</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>PRODUCTO</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>SOLIC.</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>UNIDAD</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>ENTREG.</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>P. UNIT.</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px" }}>TOTAL</th>
              <th style={{ textAlign: "center", padding: "6px 4px", fontSize: "10px", letterSpacing: "1px", width: "60px" }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "6px 4px", color: "#666" }}>{idx + 1}</td>
                <td style={{ padding: "6px 4px" }}>
                  <div>
                    <div style={{ fontWeight: "500" }}>{it.itemName}</div>
                    {it.itemSku && <div style={{ fontSize: "9px", color: "#666" }}>SKU: {it.itemSku}</div>}
                    {it.note && <div style={{ fontSize: "10px", color: "#444", fontStyle: "italic" }}>"{it.note}"</div>}
                    {it.notDeliveredReason && (
                      <div style={{ fontSize: "10px", color: "#c00", marginTop: "2px" }}>
                        Faltante: {it.notDeliveredReason}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: "600" }}>{it.qtyRequested}</td>
                <td style={{ textAlign: "right", padding: "6px 4px", color: "#666", textTransform: "lowercase" }}>{it.unit}</td>
                <td style={{ textAlign: "right", padding: "6px 4px" }}>
                  {it.qtyDelivered != null ? (
                    <span style={{
                      fontWeight: "600",
                      color: it.qtyDelivered === it.qtyRequested ? "#16a34a" : it.qtyDelivered === 0 ? "#c00" : "#ca8a04"
                    }}>
                      {it.qtyDelivered}
                    </span>
                  ) : (
                    <span style={{ color: "#bbb" }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: "right", padding: "6px 4px" }}>
                  {it.estimatedPriceCents > 0 ? fmt(it.estimatedPriceCents) : "—"}
                </td>
                <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: "600" }}>
                  {it.estimatedPriceCents > 0 ? fmt(it.qtyRequested * it.estimatedPriceCents) : "—"}
                </td>
                <td style={{ textAlign: "center", padding: "6px 4px" }}>
                  <span style={{
                    display: "inline-block",
                    width: "20px",
                    height: "20px",
                    border: "1.5px solid #999",
                    borderRadius: "3px",
                    verticalAlign: "middle",
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #000" }}>
              <td colSpan={6} style={{ padding: "8px 4px", textAlign: "right", fontSize: "11px", letterSpacing: "1px" }}>TOTAL ESTIMADO:</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "bold", fontSize: "13px" }}>
                {fmt(totalRequested)}
              </td>
              <td></td>
            </tr>
            {totalDelivered > 0 && totalDelivered !== totalRequested && (
              <tr>
                <td colSpan={6} style={{ padding: "4px 4px", textAlign: "right", fontSize: "11px", color: "#666" }}>TOTAL ENTREGADO:</td>
                <td style={{ padding: "4px 4px", textAlign: "right", fontWeight: "600", fontSize: "12px" }}>
                  {fmt(totalDelivered)}
                </td>
                <td></td>
              </tr>
            )}
          </tfoot>
        </table>

        {requisition.deliveryNote && (
          <div style={{ marginBottom: "20px", padding: "8px 12px", background: "#f9fafb", borderRadius: "4px", fontSize: "11px" }}>
            <strong>Notas de entrega:</strong> {requisition.deliveryNote}
          </div>
        )}

        {/* Firmas */}
        <div style={{ marginTop: "40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }} className="page-break-avoid">
          <div>
            <div style={{ borderTop: "1px solid #000", paddingTop: "6px", textAlign: "center" }}>
              <div style={{ fontWeight: "600", fontSize: "11px" }}>ENTREGÓ</div>
              <div style={{ fontSize: "10px", color: "#666" }}>
                {requisition.deliveredByName ?? "Almacén"}
              </div>
              {requisition.deliveredAt && (
                <div style={{ fontSize: "9px", color: "#666", marginTop: "4px" }}>
                  {new Date(requisition.deliveredAt).toLocaleString("es-MX", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
          <div>
            <div style={{ borderTop: "1px solid #000", paddingTop: "6px", textAlign: "center" }}>
              <div style={{ fontWeight: "600", fontSize: "11px" }}>RECIBIÓ</div>
              <div style={{ fontSize: "10px", color: "#666" }}>
                {requisition.receivedSignature ?? requisition.receivedByName ?? "_________________________"}
              </div>
              {requisition.receivedAt && (
                <div style={{ fontSize: "9px", color: "#666", marginTop: "4px" }}>
                  {new Date(requisition.receivedAt).toLocaleString("es-MX", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div style={{ marginTop: "30px", paddingTop: "12px", borderTop: "1px dashed #ccc", fontSize: "9px", color: "#888", textAlign: "center" }}>
          Documento generado por OPT Maestra · {new Date().toLocaleString("es-MX")}
          <br />
          Folio: {requisition.id}
        </div>
      </div>
    </>
  );
}

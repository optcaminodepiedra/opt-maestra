"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, AlertCircle, X } from "lucide-react";
import { cancelRequisition } from "@/lib/requisitions-cancel.actions";

type Props = {
  requisitionId: string;
  requisitionTitle: string;
  /**
   * Apariencia del botón. "outline" para detalle, "ghost" para listas.
   */
  variant?: "outline" | "ghost" | "destructive";
  size?: "sm" | "default";
  fullLabel?: boolean;
  /**
   * Si true, después de cancelar redirige al inventario.
   * Si false, refresca la página actual.
   */
  redirectAfter?: boolean;
};

export function CancelRequisitionButton({
  requisitionId,
  requisitionTitle,
  variant = "outline",
  size = "sm",
  fullLabel = true,
  redirectAfter = false,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (!reason.trim()) {
      setError("Indica la razón de la cancelación");
      return;
    }
    setError(null);
    start(async () => {
      try {
        await cancelRequisition({ requisitionId, reason: reason.trim() });
        setShowModal(false);
        if (redirectAfter) {
          router.push("/app/inventory");
        } else {
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setShowModal(true)}
        className={variant === "ghost" ? "text-red-600 hover:text-red-700 hover:bg-red-50" : ""}
      >
        <Trash2 className={`w-3.5 h-3.5 ${fullLabel ? "mr-1.5" : ""}`} />
        {fullLabel && "Cancelar requisición"}
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Cancelar requisición
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => { setShowModal(false); setReason(""); setError(null); }}
                  disabled={pending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                "{requisitionTitle}"
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="font-medium text-amber-900">Esta acción cancelará la requisición.</p>
                <p className="text-amber-800 mt-1">
                  La requisición quedará en estado <strong>CANCELADA</strong> y permanecerá en el historial. Si tiene una cuenta por pagar pendiente, también se cancelará.
                </p>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Razón *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="¿Por qué cancelas esta requisición? (obligatorio)"
                  className="w-full p-2 border rounded-lg text-sm bg-background mt-1 min-h-[80px]"
                  autoFocus
                  disabled={pending}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowModal(false); setReason(""); setError(null); }}
                  disabled={pending}
                >
                  No cancelar
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={pending}>
                  {pending ? "Cancelando..." : "Sí, cancelar requisición"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

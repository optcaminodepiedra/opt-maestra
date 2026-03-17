import { ReactNode } from "react";

export default function OperationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operación</h1>
        <p className="text-sm text-muted-foreground">
          Actividades, tickets y seguimiento de avance
        </p>
      </div>

      {children}
    </div>
  );
}

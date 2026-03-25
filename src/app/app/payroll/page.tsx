import { getPayrollRecords } from "@/lib/payroll.actions";
import PayrollTable from "./PayrollTable";

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control de Asistencias</h1>
          <p className="text-muted-foreground mt-1">
            Revisa las entradas, salidas y evidencias de tu equipo en tiempo real.
          </p>
        </div>
      </div>

      {/* Aquí inyectamos el componente interactivo con acordeones */}
      <PayrollTable records={records} />
    </div>
  );
}
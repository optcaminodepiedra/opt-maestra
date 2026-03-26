import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function MovementsPage() {
  return (
    <div className="p-12 text-center">
      <h1 className="text-2xl font-bold mb-4">Registro de Entradas y Salidas en Construcción 🚧</h1>
      <Button asChild><Link href="/app/inventory">Volver</Link></Button>
    </div>
  );
}
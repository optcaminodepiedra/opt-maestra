import Link from "next/link";
import { getManagerRecentExpenses } from "@/lib/expenses.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function dateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ManagerExpensesPage() {
  const items = await getManagerRecentExpenses();

  const total = items.reduce((sum, e) => sum + e.amountCents, 0) / 100;

  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Gastos</div>
          <h1 className="text-2xl font-semibold">Gastos recientes</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Últimos 60 registros (según tu alcance)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            Total: {money(total)}
          </Badge>

          <Button asChild>
            <Link href="/app/manager/expenses/new">Nuevo gasto</Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Sin gastos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(e.createdAt.toISOString())}</TableCell>
                    <TableCell>{e.business.name}</TableCell>
                    <TableCell>{e.user.fullName}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="max-w-[340px] truncate">{e.note}</TableCell>
                    <TableCell className="text-right tabular-nums">
  {money(e.amountCents / 100)}
</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

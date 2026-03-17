import Link from "next/link";
import { getManagerRecentExpenses } from "@/lib/expenses.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt } from "lucide-react";

function money(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function dt(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString("es-MX", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function OwnerExpensesPage() {
  const rows = await getManagerRecentExpenses();

  const total = rows.reduce((sum, e) => sum + e.amountCents, 0) / 100;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Gastos</h1>
          <p className="text-sm text-muted-foreground">Últimos movimientos capturados</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} registros</Badge>
          <Button asChild className="gap-2">
            <Link href="/app/ops/expense">
              <Receipt className="h-4 w-4" />
              Capturar gasto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total (lista)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{money(total)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Sin gastos todavía.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{dt(e.createdAt)}</TableCell>
                    <TableCell>{e.business?.name ?? "—"}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell>{e.note ?? ""}</TableCell>
                    <TableCell>{e.user?.fullName ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(e.amountCents / 100)}</TableCell>
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

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSalesForOwner, getSalesFormData } from "@/lib/sales.actions";
import { CreateSaleDialog } from "@/components/sales/CreateSaleDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function moneyFromCents(cents: number) {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function dt(d: Date) {
  return d.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function OwnerSalesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session as any).user?.id as string | undefined;

  const [sales, form] = await Promise.all([
    getSalesForOwner({ take: 200 }),
    getSalesFormData(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Registro y consulta de ventas (por unidad / caja / usuario)
          </p>
        </div>

        <CreateSaleDialog
          businesses={form.businesses}
          users={form.users}
          defaultUserId={userId}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Últimas ventas</CardTitle>
            <Badge variant="secondary">{sales.length}</Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Caja</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Sin ventas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{dt(s.createdAt)}</TableCell>
                    <TableCell>{s.business.name}</TableCell>
                    <TableCell>{s.cashpoint.name}</TableCell>
                    <TableCell>{s.user.fullName}</TableCell>
                    <TableCell>{s.concept}</TableCell>
                    <TableCell>{s.method}</TableCell>
                    <TableCell className="text-right">{moneyFromCents(s.amountCents)}</TableCell>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessTodayDetail } from "@/lib/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function time(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ IMPORTANTE EN NEXT 16.1
  if (!id) return notFound();

  const detail = await getBusinessTodayDetail(id);
  if (!detail) return notFound();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Unidad</div>
          <h1 className="text-2xl font-semibold">{detail.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Movimientos de hoy
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">Hoy</Badge>
          <Button asChild variant="outline">
            <Link href="/app/owner">Volver</Link>
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ventas</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(detail.salesTotal)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(detail.expensesTotal)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Retiros</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(detail.withdrawalsTotal ?? 0)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Neto</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            <span className={(detail.net ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}>
              {money(detail.net ?? 0)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Detalle</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="sales" className="w-full">
            <TabsList>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="expenses">Gastos</TabsTrigger>
              <TabsTrigger value="withdrawals">Retiros</TabsTrigger>
            </TabsList>

            <Separator className="my-4" />

            {/* Ventas */}
            <TabsContent value="sales">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Caja</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Sin ventas registradas hoy.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detail.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{time(s.createdAt)}</TableCell>
                        <TableCell>{s.concept}</TableCell>
                        <TableCell>{s.method}</TableCell>
                        <TableCell>{s.cashpoint}</TableCell>
                        <TableCell>{s.user}</TableCell>
                        <TableCell className="text-right">{money(s.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Gastos */}
            <TabsContent value="expenses">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Sin gastos registrados hoy.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detail.expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{time(e.createdAt)}</TableCell>
                        <TableCell>{e.category}</TableCell>
                        <TableCell>{e.note}</TableCell>
                        <TableCell>{e.user}</TableCell>
                        <TableCell className="text-right">{money(e.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Retiros */}
            <TabsContent value="withdrawals">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.withdrawals ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sin retiros registrados hoy.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (detail.withdrawals ?? []).map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell>{time(w.createdAt)}</TableCell>
                        <TableCell>{w.note}</TableCell>
                        <TableCell>{w.user}</TableCell>
                        <TableCell className="text-right">{money(w.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  href?: string;
  name: string;
  sales: number;
  expenses: number;
  withdrawals: number;
  net: number;
}


function Money({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      ${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
    </span>
  );
}

export function BusinessCard({
  href,
  name,
  sales,
  expenses,
  withdrawals,
  net,
}: Props) {

  const content = (
    <Card className="hover:shadow-md transition">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Unidad</div>
            <div className="text-base font-semibold leading-tight">{name}</div>
          </div>

          <Badge variant={net >= 0 ? "default" : "destructive"}>
            {net >= 0 ? "Activo" : "Alerta"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Ventas hoy</div>
            <div className="text-sm font-semibold"><Money value={sales} /></div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Gastos hoy</div>
            <div className="text-sm font-semibold"><Money value={expenses} /></div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3">
           <div className="text-xs text-muted-foreground">Retiros hoy</div>
            <div className="text-sm font-semibold">
              <Money value={withdrawals} />
          </div>
        </div>

          <div className="rounded-lg bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Neto</div>
            <div className={`text-sm font-semibold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
              <Money value={net} />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Click para ver detalle
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href} className="block">{content}</Link> : content;
}

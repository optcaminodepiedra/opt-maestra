import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  href?: string;
  name: string;
  sales: number;
  expenses: number;
  net: number;
}

function Money({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      ${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
    </span>
  );
}

export function BusinessCard({ href, name, sales, expenses, net }: Props) {
  const healthy = net >= 0;

  const content = (
    <Card className="relative overflow-hidden border border-border/80 bg-card/90 hover:shadow-lg transition">
      {/* glow */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{
          background: healthy ? "var(--accent)" : "var(--destructive)",
        }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Unidad
            </div>
            <div className="text-base font-semibold leading-tight">{name}</div>
          </div>

          <Badge
            className="rounded-full px-3"
            variant={healthy ? "default" : "destructive"}
          >
            {healthy ? "Activo" : "Alerta"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
            <div className="text-[11px] text-muted-foreground">Ventas</div>
            <div className="text-sm font-semibold">
              <Money value={sales} />
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
            <div className="text-[11px] text-muted-foreground">Gastos</div>
            <div className="text-sm font-semibold">
              <Money value={expenses} />
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
            <div className="text-[11px] text-muted-foreground">Neto</div>
            <div
              className={`text-sm font-semibold ${
                healthy ? "text-emerald-700" : "text-red-700"
              }`}
            >
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

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

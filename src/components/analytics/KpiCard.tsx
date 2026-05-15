import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";

type Props = {
  label: string;
  value: string;
  delta?: number | null;
  icon?: React.ReactNode;
  color?: "green" | "blue" | "red" | "purple" | "orange" | "amber";
  subtitle?: string;
  /** Si es true, delta negativo se muestra en verde (ej: gastos bajando es bueno). */
  invertDelta?: boolean;
  /** Texto corto para el tooltip de ayuda. */
  helpText?: string;
  /** Slug del catálogo de ayuda para el link "Más info". */
  helpSlug?: string;
};

const colorClasses: Record<NonNullable<Props["color"]>, string> = {
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  red: "border-l-red-500",
  purple: "border-l-purple-500",
  orange: "border-l-orange-500",
  amber: "border-l-amber-500",
};

export function KpiCard({
  label, value, delta, icon, color = "blue", subtitle, invertDelta,
  helpText, helpSlug,
}: Props) {
  return (
    <Card className={`border-l-4 ${colorClasses[color]} py-0`}>
      <CardContent className="px-4 py-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            {helpText && <HelpTooltip text={helpText} slug={helpSlug} />}
          </div>
          {icon}
        </div>

        <div className="space-y-1">
          <div className="text-xl md:text-2xl font-bold leading-tight">{value}</div>

          <div className="flex items-center gap-1.5 text-xs">
            {delta !== undefined && delta !== null ? (
              <DeltaBadge delta={delta} invert={invertDelta} />
            ) : null}
            {subtitle && (
              <span className="text-muted-foreground truncate">{subtitle}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ delta, invert }: { delta: number; invert?: boolean }) {
  const isPositive = invert ? delta < 0 : delta > 0;
  const isNegative = invert ? delta > 0 : delta < 0;
  const isZero = Math.abs(delta) < 0.5;

  if (isZero) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  }

  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground";
  const sign = delta > 0 ? "+" : "";

  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {sign}{delta.toFixed(1)}%
    </span>
  );
}

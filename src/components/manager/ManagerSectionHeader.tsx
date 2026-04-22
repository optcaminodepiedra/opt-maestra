import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

type Business = { id: string; name: string };

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  businesses: Business[];
  selectedBusinessId?: string | null;
  sectionBaseHref: string; // ej: "/app/manager/restaurant/finances"
  queryParam?: string;     // default: "businessId"
  children?: React.ReactNode;
};

/**
 * Header genérico para páginas de gerente. Muestra:
 * - Título + subtítulo + ícono
 * - Si el gerente tiene más de un negocio: chips seleccionables
 * - Badge "Todos" si selectedBusinessId es null
 */
export function ManagerSectionHeader({
  title,
  subtitle,
  icon,
  businesses,
  selectedBusinessId,
  sectionBaseHref,
  queryParam = "businessId",
  children,
}: Props) {
  const showSelector = businesses.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            {icon}
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex gap-2 shrink-0">{children}</div>}
      </div>

      {showSelector && (
        <div className="flex flex-wrap gap-1.5">
          <Link href={sectionBaseHref}>
            <Badge
              variant={!selectedBusinessId ? "default" : "outline"}
              className="cursor-pointer hover:opacity-80"
            >
              <Building2 className="w-3 h-3 mr-1" /> Todos
            </Badge>
          </Link>
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`${sectionBaseHref}?${queryParam}=${b.id}`}
            >
              <Badge
                variant={selectedBusinessId === b.id ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80"
              >
                {b.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

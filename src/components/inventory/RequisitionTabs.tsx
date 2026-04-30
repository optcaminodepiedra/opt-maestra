import Link from "next/link";
import { UtensilsCrossed, Sparkles, Home, Coffee, Layers } from "lucide-react";

type Tab = {
  key: string;
  label: string;
  icon: any;
  count: number;
  color: string;
  isPrivate?: boolean;
};

type Props = {
  activeTab: string;
  counts: {
    RESTAURANT: number;
    SPECIAL_EVENT: number;
    OWNER_HOUSE: number;
    VENDING_MACHINE: number;
    GENERAL: number;
  };
  showOwnerHouse: boolean; // solo Goyo y admins
};

export function RequisitionTabs({ activeTab, counts, showOwnerHouse }: Props) {
  const tabs: Tab[] = [
    { key: "all",             label: "Todas",        icon: Layers,           count: counts.RESTAURANT + counts.SPECIAL_EVENT + counts.VENDING_MACHINE + counts.GENERAL + (showOwnerHouse ? counts.OWNER_HOUSE : 0), color: "text-foreground" },
    { key: "RESTAURANT",      label: "Restaurante",  icon: UtensilsCrossed,  count: counts.RESTAURANT,      color: "text-blue-600" },
    { key: "SPECIAL_EVENT",   label: "Especiales",   icon: Sparkles,         count: counts.SPECIAL_EVENT,   color: "text-purple-600" },
    ...(showOwnerHouse
      ? [{ key: "OWNER_HOUSE", label: "Casa Navarro Smith", icon: Home, count: counts.OWNER_HOUSE, color: "text-amber-600", isPrivate: true } as Tab]
      : []),
    { key: "VENDING_MACHINE", label: "Dispensadora", icon: Coffee,           count: counts.VENDING_MACHINE, color: "text-green-600" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5 p-1 border rounded-lg bg-muted/30">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.key;
        return (
          <Link
            key={t.key}
            href={t.key === "all" ? "/app/inventory" : `/app/inventory?kind=${t.key}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              isActive
                ? "bg-background shadow-sm font-semibold"
                : "hover:bg-background/60 text-muted-foreground"
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? t.color : ""}`} />
            <span>{t.label}</span>
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
            )}
            {t.isPrivate && (
              <span className="text-[9px] text-amber-600">🔒</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

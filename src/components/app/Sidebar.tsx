"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection, NavItem, IconName } from "@/lib/nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  ArrowDownToLine,
  Users,
  FileText,
  Settings,
  KanbanSquare,
  ListChecks,
  UtensilsCrossed,
  ShoppingCart,
  CookingPot,
  Table2,
  BookOpenText,
  Hotel,
  Landmark,
  Mountain,
  Boxes,
  BadgeDollarSign,
  RadioTower,
  AppWindow,
  Clock
} from "lucide-react";

const iconMap: Record<IconName, any> = {
  dashboard: LayoutDashboard,
  finance: BadgeDollarSign,
  sales: Wallet,
  expenses: Receipt,
  withdrawals: ArrowDownToLine,
  reports: FileText,
  users: Users,
  settings: Settings,
  tasks: ListChecks,
  kanban: KanbanSquare,

  apps: AppWindow,
  reloj: Clock,

  restaurant: UtensilsCrossed,
  pos: ShoppingCart,
  kds: CookingPot,
  tables: Table2,
  menu: BookOpenText,

  hotel: Hotel,
  museum: Landmark,
  adventure: Mountain,
  inventory: Boxes,
  payroll: BadgeDollarSign,
  iot: RadioTower,
};

function ItemRow({
  it,
  pathname,
  onNavigate,
}: {
  it: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname === it.href || pathname.startsWith(it.href + "/");
  const Icon = iconMap[it.icon];

  return (
    <Link
      href={it.href}
      onClick={() => onNavigate?.()}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
        "hover:bg-muted",
        active && "bg-muted font-medium"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      />
      <span className="flex-1">{it.label}</span>

      {it.badge ? (
        <span className="text-[10px] px-2 py-[2px] rounded-full bg-muted text-muted-foreground border">
          {it.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="h-full w-72 border-r bg-background">
      <div className="p-4">
        <div className="text-base font-semibold leading-none">
          Camino de Piedra
        </div>
        <div className="text-xs text-muted-foreground mt-1">OPT Maestra</div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)] px-2 pb-4">
        <Accordion type="multiple" defaultValue={sections.map((s) => s.title)}>
          {sections.map((sec) => {
            const SecIcon = sec.icon ? iconMap[sec.icon] : null;

            return (
              <AccordionItem
                key={sec.title}
                value={sec.title}
                className="border-0"
              >
                <AccordionTrigger className="px-2 py-2 hover:no-underline">
                  <div className="flex items-center gap-2 text-sm">
                    {SecIcon ? (
                      <SecIcon className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                    <span className="font-medium">{sec.title}</span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-2">
                  <nav className="space-y-1">
                    {sec.items.map((it) => (
                      <ItemRow
                        key={it.href}
                        it={it}
                        pathname={pathname}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </nav>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}

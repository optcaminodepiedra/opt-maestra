"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, ChefHat } from "lucide-react";

type Props = {
  businessId?: string;
};

export function RestaurantBottomNav({ businessId }: Props) {
  const pathname = usePathname() || "";

  const tablesActive = pathname.startsWith("/app/restaurant/tables");
  const posActive = pathname.startsWith("/app/restaurant/pos");
  const kdsActive = pathname.startsWith("/app/restaurant/kds");

  const bizQs = businessId ? `?businessId=${businessId}` : "";

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 md:left-auto md:right-4 md:bottom-4
      md:rounded-2xl md:shadow-lg md:border md:max-w-md md:mx-auto
      bg-background border-t md:border z-40
      pb-safe
    ">
      <div className="grid grid-cols-3 max-w-md mx-auto">
        <NavItem
          href={`/app/restaurant/tables${bizQs}`}
          active={tablesActive}
          icon={Home}
          label="Mesas"
          emoji="🏠"
        />
        <NavItem
          href={`/app/restaurant/pos${bizQs}`}
          active={posActive}
          icon={ShoppingCart}
          label="POS"
          emoji="🛒"
        />
        <NavItem
          href={`/app/restaurant/kds${bizQs}`}
          active={kdsActive}
          icon={ChefHat}
          label="KDS"
          emoji="🔥"
        />
      </div>
    </nav>
  );
}

function NavItem({
  href, active, icon: Icon, label, emoji,
}: {
  href: string;
  active: boolean;
  icon: any;
  label: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      className={`
        flex flex-col items-center justify-center py-2.5 transition-colors
        ${active ? "text-orange-600 bg-orange-50" : "text-muted-foreground hover:text-foreground"}
      `}
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-[10px] font-medium mt-0.5">{label}</span>
    </Link>
  );
}

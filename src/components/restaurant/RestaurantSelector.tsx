"use client";

import { useRouter, usePathname } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type RestaurantOption = {
  id: string;
  name: string;
  tableCount: number;
};

type Props = {
  current: string;
  options: RestaurantOption[];
};

export function RestaurantSelector({ current, options }: Props) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Si solo hay 1 restaurante, no mostrar selector
  if (options.length <= 1) return null;

  const currentOption = options.find((o) => o.id === current);

  function handleSelect(id: string) {
    setOpen(false);
    // Mantener la ruta actual pero con nuevo businessId
    const url = `${pathname}?businessId=${id}`;
    router.push(url);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background
          text-sm font-medium hover:bg-muted transition-colors
        "
      >
        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="max-w-[180px] truncate">{currentOption?.name ?? "Selecciona..."}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="
          absolute left-0 mt-1 z-50 min-w-[260px]
          bg-background border rounded-lg shadow-lg overflow-hidden
        ">
          {options.map((opt) => {
            const isCurrent = opt.id === current;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-left
                  hover:bg-muted transition-colors
                  ${isCurrent ? "bg-muted/50" : ""}
                `}
              >
                <div className="flex items-center gap-2">
                  {isCurrent ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <span className="w-3.5 h-3.5" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{opt.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.tableCount} mesa{opt.tableCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

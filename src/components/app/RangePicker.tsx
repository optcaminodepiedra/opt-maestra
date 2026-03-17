"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type RangeKey = "today" | "yesterday" | "7d" | "month";

const options: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "month", label: "Mes" },
];

export function RangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = (sp.get("range") as RangeKey) ?? "today";

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(sp.toString());
    params.set("range", key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-muted-foreground">Rango:</div>

      <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
        {options.map((o) => {
          const active = current === o.key;
          return (
            <Button
              key={o.key}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRange(o.key)}
              className="h-8 px-3"
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

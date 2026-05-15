"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Business = { id: string; name: string };

type Props = {
  allBusinesses: Business[];
  selectedIds: string[];      // [] = todos
};

export function BusinessMultiSelect({ allBusinesses, selectedIds }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const allSelected = selectedIds.length === 0;
  const totalCount = allBusinesses.length;

  function updateUrl(newIds: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (newIds.length === 0 || newIds.length === totalCount) {
      params.delete("biz");
    } else {
      params.set("biz", newIds.join(","));
    }
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  function toggle(id: string) {
    let next: string[];
    if (allSelected) {
      // Si estamos "todos", seleccionar solo este
      next = [id];
    } else if (selectedIds.includes(id)) {
      next = selectedIds.filter((x) => x !== id);
      if (next.length === 0) {
        // si se quita el último, volver a "todos"
        next = [];
      }
    } else {
      next = [...selectedIds, id];
      // Si se completan todos, volver a "todos"
      if (next.length === totalCount) {
        next = [];
      }
    }
    updateUrl(next);
  }

  function selectAll() {
    updateUrl([]);
  }

  const label = allSelected
    ? `Todos los negocios (${totalCount})`
    : selectedIds.length === 1
    ? allBusinesses.find((b) => b.id === selectedIds[0])?.name ?? "1 negocio"
    : `${selectedIds.length} negocios`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} className="max-w-[260px]">
          <Building2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="space-y-0.5 max-h-96 overflow-y-auto">
          <button
            onClick={selectAll}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left ${
              allSelected ? "bg-accent" : ""
            }`}
          >
            {allSelected && <Check className="w-3.5 h-3.5 text-primary" />}
            <span className={!allSelected ? "ml-5" : ""}>
              Todos los negocios
            </span>
            <Badge variant="secondary" className="ml-auto text-[10px]">{totalCount}</Badge>
          </button>
          <div className="h-px bg-border my-1" />
          {allBusinesses.map((b) => {
            const checked = !allSelected && selectedIds.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left ${
                  checked ? "bg-accent" : ""
                }`}
              >
                {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                <span className={!checked ? "ml-5" : ""}>
                  {b.name}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

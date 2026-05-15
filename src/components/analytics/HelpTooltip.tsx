"use client";

import Link from "next/link";
import { HelpCircle, ArrowRight } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  /** Slug del término en help-catalog. Si se da, agrega link "Más info →" */
  slug?: string;
  /** Texto corto que aparece en el tooltip. */
  text: string;
  /** Tamaño del icono. */
  size?: "sm" | "md";
};

export function HelpTooltip({ slug, text, size = "sm" }: Props) {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Ayuda"
        >
          <HelpCircle className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-72 text-xs"
      >
        <p className="leading-relaxed">{text}</p>
        {slug && (
          <Link
            href={`/app/manager/ops/help#${slug}`}
            className="mt-2 inline-flex items-center gap-1 text-primary hover:underline text-[11px] font-medium"
          >
            Más información <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

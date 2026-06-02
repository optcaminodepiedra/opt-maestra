"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Calendar, Filter } from "lucide-react";
import { ACTION_CATEGORIES, ACTION_LABELS, SEVERITY_LABELS } from "@/lib/audit-actions";

interface Props {
  filters: any;
  businesses: Array<{ id: string; name: string }>;
  auditUsers: Array<{ id: string; name: string; count: number }>;
  actionStats: Array<{ action: string; count: number }>;
  onChange: (key: string, value: string | null) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "last7days", label: "Últ. 7 días" },
  { key: "last30days", label: "Últ. 30 días" },
  { key: "thismonth", label: "Este mes" },
  { key: "custom", label: "Personalizado" },
];

export default function AuditFilters({
  filters,
  businesses,
  auditUsers,
  actionStats,
  onChange,
  onClear,
  hasActiveFilters,
}: Props) {
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== (filters.search ?? "")) {
        onChange("search", searchInput || null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Presets de fecha */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={filters.preset === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => onChange("preset", p.key)}
                className="h-7 text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>
          {filters.preset === "custom" && (
            <div className="flex gap-2 items-center text-xs ml-2">
              <input
                type="date"
                defaultValue={filters.fromIso?.slice(0, 10)}
                onChange={(e) => onChange("from", e.target.value)}
                className="h-7 px-2 border rounded text-xs bg-background"
              />
              <span className="text-muted-foreground">a</span>
              <input
                type="date"
                defaultValue={filters.toIso?.slice(0, 10)}
                onChange={(e) => onChange("to", e.target.value)}
                className="h-7 px-2 border rounded text-xs bg-background"
              />
            </div>
          )}
        </div>

        {/* Filtros adicionales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select
            value={filters.userId ?? "all"}
            onChange={(e) => onChange("userId", e.target.value === "all" ? null : e.target.value)}
            className="h-8 px-2 border rounded text-xs bg-background"
          >
            <option value="all">Todos los usuarios</option>
            {auditUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.count})
              </option>
            ))}
          </select>

          <select
            value={filters.businessId ?? "all"}
            onChange={(e) => onChange("businessId", e.target.value === "all" ? null : e.target.value)}
            className="h-8 px-2 border rounded text-xs bg-background"
          >
            <option value="all">Todos los negocios</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={filters.category ?? "all"}
            onChange={(e) => onChange("category", e.target.value === "all" ? null : e.target.value)}
            className="h-8 px-2 border rounded text-xs bg-background"
          >
            <option value="all">Toda categoría</option>
            {Object.keys(ACTION_CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filters.severity ?? "all"}
            onChange={(e) => onChange("severity", e.target.value === "all" ? null : e.target.value)}
            className="h-8 px-2 border rounded text-xs bg-background"
          >
            <option value="all">Toda severidad</option>
            <option value="LOW">Bajo</option>
            <option value="MEDIUM">Medio</option>
            <option value="HIGH">Alto</option>
            <option value="CRITICAL">Crítico</option>
          </select>

          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-8 pl-7 pr-2 border rounded text-xs bg-background"
            />
          </div>
        </div>

        {/* Filtros activos / clear */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase">Activos:</span>
            {filters.userId && (
              <Badge variant="outline" className="text-[10px] gap-1">
                Usuario: {auditUsers.find((u) => u.id === filters.userId)?.name ?? filters.userId.slice(-6)}
                <button onClick={() => onChange("userId", null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            {filters.businessId && (
              <Badge variant="outline" className="text-[10px] gap-1">
                Negocio: {businesses.find((b) => b.id === filters.businessId)?.name ?? filters.businessId}
                <button onClick={() => onChange("businessId", null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            {filters.category && (
              <Badge variant="outline" className="text-[10px] gap-1">
                Categoría: {filters.category}
                <button onClick={() => onChange("category", null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            {filters.severity && (
              <Badge variant="outline" className="text-[10px] gap-1">
                Severidad: {SEVERITY_LABELS[filters.severity] ?? filters.severity}
                <button onClick={() => onChange("severity", null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            {filters.search && (
              <Badge variant="outline" className="text-[10px] gap-1">
                "{filters.search}"
                <button onClick={() => onChange("search", null)}><X className="w-2.5 h-2.5" /></button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-xs">
              Limpiar todo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

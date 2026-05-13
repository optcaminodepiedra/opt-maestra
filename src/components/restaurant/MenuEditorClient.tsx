"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Edit2, Copy, Trash2, X, Check, AlertCircle,
  BookOpen, Settings, DollarSign, ToggleLeft, ToggleRight,
  Tag, Star, Filter, ChefHat, Coffee, Image as ImageIcon,
} from "lucide-react";
import {
  createMenuItem, updateMenuItem, deleteMenuItem, duplicateMenuItem,
  bulkUpdateMenuItems,
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifier, updateModifier, deleteModifier,
  renameCategory,
} from "@/lib/menu-edit.actions";
import { ItemEditModal } from "./MenuEditorModals";
import { ModifiersManagerModal } from "./MenuEditorModals";
import { BulkActionsModal } from "./MenuEditorModals";

export type MenuItemEdit = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  isActive: boolean;
  isFeatured: boolean;
  station: "KITCHEN" | "BAR" | "NONE";
  sortOrder: number;
  imageUrl: string | null;
  description: string | null;
  modifierGroupIds: string[];
};

export type ModifierGroupEdit = {
  id: string;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  minSelections: number;
  maxSelections: number | null;
  sortOrder: number;
  modifiers: Array<{
    id: string;
    name: string;
    priceCents: number;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  }>;
};

type Props = {
  businessId: string;
  initialItems: MenuItemEdit[];
  initialModifierGroups: ModifierGroupEdit[];
  initialCategories: string[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function MenuEditorClient({
  businessId, initialItems, initialModifierGroups, initialCategories,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStation, setFilterStation] = useState<"ALL" | "KITCHEN" | "BAR" | "NONE">("ALL");
  const [showInactive, setShowInactive] = useState(false);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modales
  const [editingItem, setEditingItem] = useState<MenuItemEdit | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  // Renombrar categoría
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  // ─── Filtros ─────────────────────────────────────────────────

  const visibleItems = useMemo(() => {
    let items = initialItems;
    if (!showInactive) items = items.filter((i) => i.isActive);
    if (filterCategory !== "ALL") items = items.filter((i) => i.category === filterCategory);
    if (filterStation !== "ALL") items = items.filter((i) => i.station === filterStation);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [initialItems, showInactive, filterCategory, filterStation, search]);

  // Agrupar por categoría para vista
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, MenuItemEdit[]> = {};
    for (const item of visibleItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [visibleItems]);

  const categoryList = useMemo(() =>
    Object.keys(groupedByCategory).sort(),
    [groupedByCategory]
  );

  // ─── Acciones ────────────────────────────────────────────────

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function selectAll() {
    setSelectedIds(new Set(visibleItems.map((i) => i.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleToggleActive(item: MenuItemEdit) {
    start(async () => {
      try {
        await updateMenuItem({ id: item.id, isActive: !item.isActive });
        showSuccess(item.isActive ? "Producto desactivado" : "Producto activado");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDuplicate(item: MenuItemEdit) {
    start(async () => {
      try {
        await duplicateMenuItem(item.id);
        showSuccess(`"${item.name}" duplicado`);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleDelete(item: MenuItemEdit) {
    if (!confirm(`¿Eliminar "${item.name}"?\n\nSi tiene ventas históricas, se desactivará en lugar de borrarse.`)) return;
    start(async () => {
      try {
        const res = await deleteMenuItem(item.id);
        showSuccess(res.deactivated ? `"${item.name}" desactivado (tiene histórico)` : `"${item.name}" eliminado`);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleRenameCategory() {
    if (!renamingCat || !newCatName.trim()) return;
    start(async () => {
      try {
        const res = await renameCategory({
          businessId,
          oldName: renamingCat,
          newName: newCatName.trim(),
        });
        showSuccess(`Categoría renombrada (${res.updated} productos actualizados)`);
        setRenamingCat(null);
        setNewCatName("");
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full h-9 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-9 px-3 border rounded-lg text-sm bg-background"
            >
              <option value="ALL">Todas las categorías</option>
              {initialCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filterStation}
              onChange={(e) => setFilterStation(e.target.value as any)}
              className="h-9 px-3 border rounded-lg text-sm bg-background"
            >
              <option value="ALL">Todas las estaciones</option>
              <option value="KITCHEN">🍳 Cocina</option>
              <option value="BAR">🍸 Barra</option>
              <option value="NONE">Sin estación</option>
            </select>

            <Button
              size="sm"
              variant={showInactive ? "secondary" : "outline"}
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {visibleItems.length} producto{visibleItems.length !== 1 ? "s" : ""} visible{visibleItems.length !== 1 ? "s" : ""}
              {selectedIds.size > 0 && ` · ${selectedIds.size} seleccionado${selectedIds.size !== 1 ? "s" : ""}`}
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowBulk(true)}>
                    <Settings className="w-3.5 h-3.5 mr-1" /> Acciones masivas ({selectedIds.size})
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    <X className="w-3.5 h-3.5 mr-1" /> Limpiar
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowModifiers(true)}>
                <Tag className="w-3.5 h-3.5 mr-1" /> Modificadores
              </Button>
              <Button size="sm" onClick={() => setCreatingItem(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo producto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos agrupados por categoría */}
      {visibleItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay productos que coincidan con los filtros</p>
          </CardContent>
        </Card>
      ) : (
        categoryList.map((cat) => {
          const items = groupedByCategory[cat];
          const allSelected = items.every((i) => selectedIds.has(i.id));
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (allSelected) items.forEach((i) => next.delete(i.id));
                        else items.forEach((i) => next.add(i.id));
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4"
                    />
                    {renamingCat === cat ? (
                      <div className="flex gap-1 items-center">
                        <input
                          type="text"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="h-7 px-2 border rounded text-sm bg-background"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleRenameCategory} disabled={pending}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRenamingCat(null); setNewCatName(""); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {cat}
                        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-6 p-0 ml-1"
                          onClick={() => { setRenamingCat(cat); setNewCatName(cat); }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onEdit={() => setEditingItem(item)}
                      onToggleActive={() => handleToggleActive(item)}
                      onDuplicate={() => handleDuplicate(item)}
                      onDelete={() => handleDelete(item)}
                      pending={pending}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* MODALES */}
      {editingItem && (
        <ItemEditModal
          mode="edit"
          businessId={businessId}
          item={editingItem}
          categories={initialCategories}
          modifierGroups={initialModifierGroups}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); router.refresh(); showSuccess("Producto actualizado"); }}
        />
      )}
      {creatingItem && (
        <ItemEditModal
          mode="create"
          businessId={businessId}
          categories={initialCategories}
          modifierGroups={initialModifierGroups}
          onClose={() => setCreatingItem(false)}
          onSaved={() => { setCreatingItem(false); router.refresh(); showSuccess("Producto creado"); }}
        />
      )}
      {showModifiers && (
        <ModifiersManagerModal
          businessId={businessId}
          modifierGroups={initialModifierGroups}
          onClose={() => setShowModifiers(false)}
          onChanged={() => router.refresh()}
        />
      )}
      {showBulk && (
        <BulkActionsModal
          businessId={businessId}
          itemIds={Array.from(selectedIds)}
          categories={initialCategories}
          onClose={() => setShowBulk(false)}
          onApplied={(msg) => { setShowBulk(false); clearSelection(); router.refresh(); showSuccess(msg); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function ItemRow({
  item, isSelected, onToggleSelect, onEdit, onToggleActive, onDuplicate, onDelete, pending,
}: {
  item: MenuItemEdit;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 p-2.5 hover:bg-muted/30 ${!item.isActive ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="h-4 w-4 shrink-0"
      />

      {/* Imagen mini */}
      <div className="w-12 h-12 bg-muted rounded shrink-0 flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium">{item.name}</p>
          {item.isFeatured && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
          {item.station === "BAR" && (
            <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700">🍸 Barra</Badge>
          )}
          {item.station === "KITCHEN" && (
            <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700">🍳 Cocina</Badge>
          )}
          {!item.isActive && <Badge variant="secondary" className="text-[9px]">Inactivo</Badge>}
          {item.modifierGroupIds.length > 0 && (
            <Badge variant="outline" className="text-[9px]">+{item.modifierGroupIds.length} mod</Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
        )}
      </div>

      <p className="text-sm font-bold w-24 text-right shrink-0">{fmt(item.priceCents)}</p>

      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} disabled={pending} title="Editar">
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onToggleActive} disabled={pending} title={item.isActive ? "Desactivar" : "Activar"}>
          {item.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDuplicate} disabled={pending} title="Duplicar">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={onDelete} disabled={pending} title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

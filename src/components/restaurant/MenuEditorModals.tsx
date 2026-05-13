"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X, Save, Plus, Trash2, Edit2, Check, AlertCircle, Image as ImageIcon,
  Star, ChefHat, Coffee, Tag, DollarSign, Percent,
} from "lucide-react";
import {
  createMenuItem, updateMenuItem,
  bulkUpdateMenuItems,
  createModifierGroup, updateModifierGroup, deleteModifierGroup,
  createModifier, updateModifier, deleteModifier,
} from "@/lib/menu-edit.actions";
import type { MenuItemEdit, ModifierGroupEdit } from "./MenuEditorClient";

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

// ═══════════════════════════════════════════════════════════════
// MODAL: Crear / Editar producto
// ═══════════════════════════════════════════════════════════════

export function ItemEditModal({
  mode, businessId, item, categories, modifierGroups, onClose, onSaved,
}: {
  mode: "create" | "edit";
  businessId: string;
  item?: MenuItemEdit;
  categories: string[];
  modifierGroups: ModifierGroupEdit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [priceInput, setPriceInput] = useState(item ? (item.priceCents / 100).toString() : "");
  const [station, setStation] = useState<"KITCHEN" | "BAR" | "NONE">(item?.station ?? "KITCHEN");
  const [description, setDescription] = useState(item?.description ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [isFeatured, setIsFeatured] = useState(item?.isFeatured ?? false);
  const [selectedModGroups, setSelectedModGroups] = useState<Set<string>>(
    new Set(item?.modifierGroupIds ?? [])
  );

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es requerido");
      return;
    }
    const finalCategory = useNewCategory ? newCategory.trim() : category.trim();
    if (!finalCategory) {
      setError("La categoría es requerida");
      return;
    }
    const priceNum = parseFloat(priceInput);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Precio inválido");
      return;
    }

    const priceCents = Math.round(priceNum * 100);

    start(async () => {
      try {
        if (mode === "create") {
          await createMenuItem({
            businessId,
            name: trimmedName,
            category: finalCategory,
            priceCents,
            station,
            description: description.trim(),
            imageUrl: imageUrl.trim(),
            isFeatured,
            modifierGroupIds: Array.from(selectedModGroups),
          });
        } else if (item) {
          await updateMenuItem({
            id: item.id,
            name: trimmedName,
            category: finalCategory,
            priceCents,
            station,
            description: description.trim(),
            imageUrl: imageUrl.trim(),
            isFeatured,
            modifierGroupIds: Array.from(selectedModGroups),
          });
        }
        onSaved();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <CardHeader className="pb-3 sticky top-0 bg-background z-10 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {mode === "create" ? "Nuevo producto" : `Editar: ${item?.name}`}
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          {/* Nombre */}
          <Field label="Nombre *">
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hamburguesa tradicional"
              className="w-full h-9 px-3 border rounded text-sm bg-background"
              autoFocus
            />
          </Field>

          {/* Categoría */}
          <Field label="Categoría *">
            {useNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text" value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nueva categoría"
                  className="flex-1 h-9 px-3 border rounded text-sm bg-background"
                />
                <Button size="sm" variant="outline" onClick={() => setUseNewCategory(false)}>
                  Usar existente
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 h-9 px-3 border rounded text-sm bg-background"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={() => setUseNewCategory(true)}>
                  + Nueva
                </Button>
              </div>
            )}
          </Field>

          {/* Precio y estación */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (MXN) *">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number" step="0.01" min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-9 pl-7 pr-3 border rounded text-sm bg-background"
                />
              </div>
            </Field>

            <Field label="Estación de impresión">
              <select
                value={station}
                onChange={(e) => setStation(e.target.value as any)}
                className="w-full h-9 px-3 border rounded text-sm bg-background"
              >
                <option value="KITCHEN">🍳 Cocina</option>
                <option value="BAR">🍸 Barra</option>
                <option value="NONE">Sin impresión</option>
              </select>
            </Field>
          </div>

          {/* Descripción */}
          <Field label="Descripción (opcional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ingredientes, especificaciones..."
              rows={2}
              className="w-full px-3 py-2 border rounded text-sm bg-background resize-y"
            />
          </Field>

          {/* Imagen URL */}
          <Field label="URL de imagen (opcional)">
            <input
              type="url" value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://lh3.googleusercontent.com/..."
              className="w-full h-9 px-3 border rounded text-sm bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Pega un link de Google Photos, Imgur, o cualquier imagen pública
            </p>
            {imageUrl && (
              <div className="mt-2 border rounded p-2 bg-muted/30 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            )}
          </Field>

          {/* Destacado */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4"
            />
            <Star className="w-4 h-4 text-amber-500" />
            Marcar como destacado
          </label>

          {/* Grupos de modificadores */}
          {modifierGroups.length > 0 && (
            <Field label="Grupos de modificadores aplicables">
              <div className="border rounded p-2 space-y-1 max-h-48 overflow-y-auto bg-muted/20">
                {modifierGroups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-background rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModGroups.has(g.id)}
                      onChange={(e) => {
                        const next = new Set(selectedModGroups);
                        if (e.target.checked) next.add(g.id);
                        else next.delete(g.id);
                        setSelectedModGroups(next);
                      }}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{g.name}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {g.selectionMode === "SINGLE" ? "Una sola" : "Múltiple"}
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">
                      {g.modifiers.length} opciones
                    </Badge>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {/* Botones */}
          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={pending}>
              <Save className="w-4 h-4 mr-1" />
              {pending ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL: Gestión de grupos de modificadores
// ═══════════════════════════════════════════════════════════════

export function ModifiersManagerModal({
  businessId, modifierGroups, onClose, onChanged,
}: {
  businessId: string;
  modifierGroups: ModifierGroupEdit[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | "new" | null>(null);

  // Form para nuevo grupo
  const [gName, setGName] = useState("");
  const [gMode, setGMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [gRequired, setGRequired] = useState(false);

  function openNewGroup() {
    setGName("");
    setGMode("SINGLE");
    setGRequired(false);
    setEditingGroupId("new");
  }

  function saveGroup() {
    if (!gName.trim()) { setError("Nombre requerido"); return; }
    start(async () => {
      try {
        if (editingGroupId === "new") {
          await createModifierGroup({
            businessId,
            name: gName.trim(),
            selectionMode: gMode,
            isRequired: gRequired,
            minSelections: gRequired ? 1 : 0,
            maxSelections: gMode === "SINGLE" ? 1 : null,
          });
        } else if (editingGroupId) {
          await updateModifierGroup({
            id: editingGroupId,
            name: gName.trim(),
            selectionMode: gMode,
            isRequired: gRequired,
            minSelections: gRequired ? 1 : 0,
            maxSelections: gMode === "SINGLE" ? 1 : null,
          });
        }
        setEditingGroupId(null);
        onChanged();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function deleteGroup(id: string, name: string) {
    if (!confirm(`¿Eliminar el grupo "${name}" y todos sus modificadores?`)) return;
    start(async () => {
      try {
        await deleteModifierGroup(id);
        onChanged();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        <CardHeader className="pb-3 sticky top-0 bg-background z-10 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" /> Grupos de modificadores
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={openNewGroup}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo grupo
            </Button>
          </div>

          {/* Form de grupo (crear/editar) */}
          {editingGroupId && (
            <Card className="border-primary">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {editingGroupId === "new" ? "Nuevo grupo" : "Editar grupo"}
                </p>
                <input
                  type="text" value={gName}
                  onChange={(e) => setGName(e.target.value)}
                  placeholder="Nombre del grupo (ej: Término, Extras, Salsas)"
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                />
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={gMode === "SINGLE"} onChange={() => setGMode("SINGLE")} />
                    Selección única
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={gMode === "MULTIPLE"} onChange={() => setGMode("MULTIPLE")} />
                    Múltiple
                  </label>
                </div>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={gRequired} onChange={(e) => setGRequired(e.target.checked)} />
                  Obligatorio (debe seleccionarse al menos 1)
                </label>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingGroupId(null)}>Cancelar</Button>
                  <Button size="sm" onClick={saveGroup} disabled={pending}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de grupos */}
          {modifierGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay grupos de modificadores todavía.
            </p>
          ) : (
            modifierGroups.map((g) => (
              <ModifierGroupCard
                key={g.id}
                group={g}
                onEdit={() => {
                  setGName(g.name);
                  setGMode(g.selectionMode);
                  setGRequired(g.isRequired);
                  setEditingGroupId(g.id);
                }}
                onDelete={() => deleteGroup(g.id, g.name)}
                onChanged={onChanged}
                pending={pending}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModifierGroupCard({
  group, onEdit, onDelete, onChanged, pending,
}: {
  group: ModifierGroupEdit;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
  pending: boolean;
}) {
  const [, start] = useTransition();
  const [addingMod, setAddingMod] = useState(false);
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");

  function addModifier() {
    if (!modName.trim()) return;
    const priceCents = Math.round((parseFloat(modPrice) || 0) * 100);
    start(async () => {
      try {
        await createModifier({
          groupId: group.id,
          name: modName.trim(),
          priceCents,
        });
        setModName("");
        setModPrice("");
        setAddingMod(false);
        onChanged();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  function removeModifier(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    start(async () => {
      try {
        await deleteModifier(id);
        onChanged();
      } catch (err: any) {
        alert(err.message);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-medium text-sm">{group.name}</p>
            <div className="flex gap-1 mt-1">
              <Badge variant="outline" className="text-[9px]">
                {group.selectionMode === "SINGLE" ? "Selección única" : "Múltiple"}
              </Badge>
              {group.isRequired && <Badge variant="default" className="text-[9px]">Obligatorio</Badge>}
              <Badge variant="secondary" className="text-[9px]">{group.modifiers.length} opciones</Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} disabled={pending}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={onDelete} disabled={pending}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          {group.modifiers.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
              <div className="flex items-center gap-2">
                {m.isDefault && <Badge variant="default" className="text-[9px]">Default</Badge>}
                <span>{m.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {m.priceCents > 0 && (
                  <span className="text-green-700 font-medium">+{fmt(m.priceCents)}</span>
                )}
                {m.priceCents < 0 && (
                  <span className="text-red-700 font-medium">{fmt(m.priceCents)}</span>
                )}
                <Button
                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                  onClick={() => removeModifier(m.id, m.name)}
                  disabled={pending}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}

          {addingMod ? (
            <div className="flex gap-1 items-center p-2 bg-blue-50 border border-blue-200 rounded">
              <input
                type="text" value={modName}
                onChange={(e) => setModName(e.target.value)}
                placeholder="Nombre"
                className="flex-1 h-8 px-2 border rounded text-sm bg-background"
                autoFocus
              />
              <input
                type="number" step="0.01" value={modPrice}
                onChange={(e) => setModPrice(e.target.value)}
                placeholder="Precio"
                className="w-20 h-8 px-2 border rounded text-sm bg-background"
              />
              <Button size="sm" onClick={addModifier} disabled={pending}>
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingMod(false); setModName(""); setModPrice(""); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setAddingMod(true)}>
              <Plus className="w-3 h-3 mr-1" /> Agregar opción
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODAL: Acciones masivas
// ═══════════════════════════════════════════════════════════════

export function BulkActionsModal({
  businessId, itemIds, categories, onClose, onApplied,
}: {
  businessId: string;
  itemIds: string[];
  categories: string[];
  onClose: () => void;
  onApplied: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actionType, setActionType] = useState<
    "activate" | "deactivate" | "delete" | "changePrice" | "changeCategory" | "changeStation"
  >("activate");

  // Sub-config para changePrice
  const [priceMode, setPriceMode] = useState<"percent" | "fixed" | "delta">("percent");
  const [priceValue, setPriceValue] = useState("");

  // Sub-config para changeCategory
  const [newCategory, setNewCategory] = useState(categories[0] ?? "");

  // Sub-config para changeStation
  const [newStation, setNewStation] = useState<"KITCHEN" | "BAR" | "NONE">("KITCHEN");

  function apply() {
    let operation: any;
    let msg = "";

    if (actionType === "activate") {
      operation = { type: "activate" };
      msg = `${itemIds.length} producto(s) activado(s)`;
    } else if (actionType === "deactivate") {
      operation = { type: "deactivate" };
      msg = `${itemIds.length} producto(s) desactivado(s)`;
    } else if (actionType === "delete") {
      if (!confirm(`¿Eliminar ${itemIds.length} producto(s)?\n\nLos que tengan ventas históricas se desactivarán.`)) return;
      operation = { type: "delete" };
      msg = `${itemIds.length} producto(s) eliminado(s)`;
    } else if (actionType === "changePrice") {
      const val = parseFloat(priceValue);
      if (isNaN(val)) { setError("Valor numérico inválido"); return; }
      operation = {
        type: "changePrice",
        mode: priceMode,
        value: priceMode === "fixed" ? Math.round(val * 100) : (priceMode === "delta" ? Math.round(val * 100) : val),
      };
      const desc =
        priceMode === "percent" ? `${val > 0 ? "+" : ""}${val}%` :
        priceMode === "delta" ? `${val > 0 ? "+" : ""}${fmt(Math.round(val * 100))}` :
        fmt(Math.round(val * 100));
      msg = `Precios actualizados: ${desc}`;
    } else if (actionType === "changeCategory") {
      if (!newCategory.trim()) { setError("Categoría requerida"); return; }
      operation = { type: "changeCategory", newCategory };
      msg = `Categoría cambiada a "${newCategory}"`;
    } else if (actionType === "changeStation") {
      operation = { type: "changeStation", station: newStation };
      msg = `Estación cambiada a ${newStation === "KITCHEN" ? "Cocina" : newStation === "BAR" ? "Barra" : "Sin estación"}`;
    }

    start(async () => {
      try {
        const res = await bulkUpdateMenuItems({ businessId, itemIds, operation });
        onApplied(`${msg} (${res.updated})`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Acciones masivas ({itemIds.length} producto{itemIds.length !== 1 ? "s" : ""})
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <Field label="Acción a aplicar">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as any)}
              className="w-full h-9 px-3 border rounded text-sm bg-background"
            >
              <option value="activate">✓ Activar</option>
              <option value="deactivate">✗ Desactivar</option>
              <option value="changePrice">💰 Cambiar precios</option>
              <option value="changeCategory">📁 Cambiar categoría</option>
              <option value="changeStation">🍳 Cambiar estación</option>
              <option value="delete">🗑 Eliminar</option>
            </select>
          </Field>

          {actionType === "changePrice" && (
            <>
              <Field label="Modo de cambio">
                <select
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as any)}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                >
                  <option value="percent">Porcentaje (ej: +10 = subir 10%)</option>
                  <option value="delta">Suma/Resta fija (ej: +20 = sumar $20)</option>
                  <option value="fixed">Precio fijo idéntico para todos</option>
                </select>
              </Field>
              <Field label={
                priceMode === "percent" ? "Porcentaje (positivo sube, negativo baja)" :
                priceMode === "delta" ? "Monto en pesos (positivo suma, negativo resta)" :
                "Precio nuevo en pesos"
              }>
                <input
                  type="number" step="0.01" value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  placeholder={priceMode === "percent" ? "10" : "0.00"}
                  className="w-full h-9 px-3 border rounded text-sm bg-background"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {priceMode === "percent" && "Ej: 10 sube 10%, -5 baja 5%"}
                  {priceMode === "delta" && "Ej: 20 suma $20, -5 resta $5"}
                  {priceMode === "fixed" && "Todos los productos quedarán con este precio"}
                </p>
              </Field>
            </>
          )}

          {actionType === "changeCategory" && (
            <Field label="Nueva categoría">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full h-9 px-3 border rounded text-sm bg-background"
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}

          {actionType === "changeStation" && (
            <Field label="Nueva estación">
              <select
                value={newStation}
                onChange={(e) => setNewStation(e.target.value as any)}
                className="w-full h-9 px-3 border rounded text-sm bg-background"
              >
                <option value="KITCHEN">🍳 Cocina</option>
                <option value="BAR">🍸 Barra</option>
                <option value="NONE">Sin estación</option>
              </select>
            </Field>
          )}

          <div className="flex gap-2 justify-end pt-3 border-t">
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button onClick={apply} disabled={pending}>
              <Check className="w-4 h-4 mr-1" />
              {pending ? "Aplicando..." : "Aplicar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Field helper
// ═══════════════════════════════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase text-muted-foreground mb-1 block tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

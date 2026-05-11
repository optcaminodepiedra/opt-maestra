"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Minus, Trash2, ChefHat, DollarSign, X,
  ShoppingCart, AlertCircle, ArrowLeft, ChevronUp, ChevronDown,
  StickyNote, Send, CreditCard, Coffee, UtensilsCrossed, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import {
  addItemToOrder, updateItemQuantity, updateItemNote,
  sendOrderToKitchen, checkoutOrder,
} from "@/lib/pos.actions";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  isActive: boolean;
  station?: "KITCHEN" | "BAR" | "NONE";
};

type OrderItem = {
  id: string;
  menuItemId: string;
  name: string;
  category: string;
  station: "KITCHEN" | "BAR" | "NONE";
  qty: number;
  priceCents: number;
  note: string | null;
  kitchenStatus: string;
  subtotalCents: number;
};

type Order = {
  id: string;
  businessId: string;
  tableId: string | null;
  tableName: string;
  tableArea: string | null;
  tableCapacity: number;
  mesero: string;
  status: string;
  note: string | null;
  openedAt: string;
  totalCents: number;
  items: OrderItem[];
};

type Props = {
  order: Order;
  categories: Record<string, MenuItem[]>;
  categoryNames: string[];
  cashpoints: Array<{ id: string; name: string }>;
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "☕", "café": "☕",
  cocteles: "🍸", "cócteles": "🍸",
  desayunos: "🍳",
  entradas: "🥟",
  ensaladas: "🥗",
  sopas: "🍲",
  pastas: "🍝",
  grill: "🥩",
  aves: "🍗",
  "del mar": "🐟",
  pizzas: "🍕",
  hamburguesas: "🍔",
  postres: "🍰",
  bebidas: "🥤",
  refrescos: "🥤",
  cerveza: "🍺",
  cervezas: "🍺",
};

function emojiFor(cat: string) {
  const k = cat.toLowerCase().trim();
  return CATEGORY_EMOJI[k] ?? "🍽️";
}

export function POSClient({ order: initialOrder, categories, categoryNames, cashpoints }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [activeCategory, setActiveCategory] = useState<string | "ALL">(categoryNames[0] ?? "ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");

  // Modal de modificadores (long-press)
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [modifierQty, setModifierQty] = useState(1);
  const [modifierNote, setModifierNote] = useState("");

  // Modal de editar item
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editingNote, setEditingNote] = useState("");

  // Modal de checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [cashpointId, setCashpointId] = useState(cashpoints[0]?.id ?? "");
  const [tipAmount, setTipAmount] = useState(0);

  // Long-press detection
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Re-sync con props
  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // ─── Filtros ─────────────────────────────────────────────────

  const visibleItems = useMemo(() => {
    let items: MenuItem[] = [];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      for (const cat of categoryNames) {
        items.push(...(categories[cat] || []).filter((i) => i.name.toLowerCase().includes(q)));
      }
    } else if (activeCategory === "ALL") {
      for (const cat of categoryNames) {
        items.push(...(categories[cat] || []));
      }
    } else {
      items = categories[activeCategory] || [];
    }
    return items;
  }, [search, activeCategory, categories, categoryNames]);

  // ─── Cálculos ────────────────────────────────────────────────

  const subtotal = useMemo(() => order.items.reduce((s, i) => s + i.subtotalCents, 0), [order.items]);
  const total = subtotal + tipAmount;
  const hasNewItems = order.items.some((i) => i.kitchenStatus === "NEW");
  const allDelivered = order.items.length > 0 && order.items.every(
    (i) => i.kitchenStatus === "READY" || i.kitchenStatus === "DELIVERED"
  );
  const newItemsCount = order.items.filter((i) => i.kitchenStatus === "NEW").length;

  // ─── Acciones ────────────────────────────────────────────────

  function handleProductPress(item: MenuItem) {
    // Tap rápido = +1 cantidad
    start(async () => {
      try {
        await addItemToOrder({ orderId: order.id, menuItemId: item.id, qty: 1 });
        router.refresh();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleProductLongPress(item: MenuItem) {
    setModifierItem(item);
    setModifierQty(1);
    setModifierNote("");
  }

  function handleAddWithModifiers() {
    if (!modifierItem) return;
    start(async () => {
      try {
        await addItemToOrder({
          orderId: order.id,
          menuItemId: modifierItem.id,
          qty: modifierQty,
          note: modifierNote.trim() || undefined,
        });
        setModifierItem(null);
        router.refresh();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleItemQtyChange(item: OrderItem, delta: number) {
    if (item.kitchenStatus !== "NEW") return;
    const newQty = item.qty + delta;
    start(async () => {
      try {
        await updateItemQuantity({ itemId: item.id, qty: newQty });
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleItemDelete(item: OrderItem) {
    if (item.kitchenStatus !== "NEW") return;
    if (!confirm(`¿Quitar ${item.name} de la orden?`)) return;
    start(async () => {
      try {
        await updateItemQuantity({ itemId: item.id, qty: 0 });
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleEditNote(item: OrderItem) {
    setEditingItem(item);
    setEditingNote(item.note || "");
  }

  function handleSaveNote() {
    if (!editingItem) return;
    start(async () => {
      try {
        await updateItemNote({ itemId: editingItem.id, note: editingNote });
        setEditingItem(null);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleSendToKitchen() {
    if (!hasNewItems) return;
    start(async () => {
      try {
        await sendOrderToKitchen(order.id);
        router.refresh();
        setError(null);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleCheckout() {
    if (order.items.length === 0) {
      setError("La orden está vacía");
      return;
    }
    setCheckoutOpen(true);
    setPaymentMethod("CASH");
    setTipAmount(0);
  }

  function handleConfirmCheckout() {
    start(async () => {
      try {
        const res = await checkoutOrder({
          orderId: order.id,
          paymentMethod,
          cashpointId,
          tipCents: tipAmount,
        });
        // Redirigir a mesas después de cobrar
        router.push(`/app/restaurant/tables?businessId=${order.businessId}`);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  // ─── Helpers long-press en touch ─────────────────────────────

  function bindLongPress(item: MenuItem) {
    return {
      onClick: () => handleProductPress(item),
      onMouseDown: () => {
        longPressTimer.current = setTimeout(() => handleProductLongPress(item), 500);
      },
      onMouseUp: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      },
      onMouseLeave: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      },
      onTouchStart: () => {
        longPressTimer.current = setTimeout(() => handleProductLongPress(item), 500);
      },
      onTouchEnd: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      },
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        handleProductLongPress(item);
      },
    };
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col pb-24">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-30">
        <div className="p-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/restaurant/tables?businessId=${order.businessId}`}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-orange-500" />
              Mesa {order.tableName}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {order.tableArea} · {order.mesero}
            </p>
          </div>
          <Badge variant={order.status === "OPEN" ? "outline" : "default"} className="text-[10px]">
            {order.status === "OPEN" ? "Abierta" : order.status === "SENT" ? "En cocina" : order.status}
          </Badge>
        </div>

        {/* Tabs móvil: productos / carrito */}
        <div className="lg:hidden flex border-t">
          <button
            onClick={() => setMobileTab("products")}
            className={`flex-1 py-2 text-sm font-medium ${mobileTab === "products" ? "bg-primary text-primary-foreground" : ""}`}
          >
            🍽️ Productos
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex-1 py-2 text-sm font-medium relative ${mobileTab === "cart" ? "bg-primary text-primary-foreground" : ""}`}
          >
            🛒 Orden ({order.items.length})
            {order.items.length > 0 && (
              <span className="absolute top-1 right-2 text-[10px] font-bold">
                {fmt(subtotal)}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="m-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[180px_1fr_360px] gap-0 overflow-hidden">
        {/* COLUMNA 1: Categorías */}
        <div className={`${mobileTab === "products" ? "block" : "hidden"} lg:block border-r bg-muted/20 overflow-y-auto`}>
          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveCategory("ALL")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                activeCategory === "ALL" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              🍽️ Todo
            </button>
            {categoryNames.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch(""); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  activeCategory === cat ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span className="mr-2">{emojiFor(cat)}</span>
                <span className="truncate">{cat}</span>
                <span className="ml-1 text-[10px] opacity-60">({categories[cat]?.length ?? 0})</span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUMNA 2: Productos */}
        <div className={`${mobileTab === "products" ? "block" : "hidden"} lg:block overflow-y-auto`}>
          {/* Buscador */}
          <div className="sticky top-0 bg-background p-3 border-b z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              💡 <strong>Tap</strong> = agregar 1 · <strong>Mantén presionado</strong> = cantidad + nota
            </p>
          </div>

          {/* Grid productos */}
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {visibleItems.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground text-sm py-12">
                {search ? "No se encontraron productos" : "No hay productos en esta categoría"}
              </div>
            ) : (
              visibleItems.map((item) => (
                <button
                  key={item.id}
                  {...bindLongPress(item)}
                  disabled={pending}
                  className="
                    flex flex-col items-center justify-between
                    aspect-square p-3 rounded-xl border-2 border-muted
                    bg-background hover:border-primary hover:shadow-md
                    active:scale-95 transition-all
                    text-left select-none
                  "
                  style={{ userSelect: "none", WebkitTouchCallout: "none" } as any}
                >
                  <div className="w-full">
                    <p className="text-sm font-bold leading-tight line-clamp-2">{item.name}</p>
                    {item.station === "BAR" && (
                      <span className="inline-block mt-1 text-[9px] bg-purple-100 text-purple-700 px-1 rounded">
                        BARRA
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-primary">{fmt(item.priceCents)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 3: Orden actual */}
        <div className={`${mobileTab === "cart" ? "block" : "hidden"} lg:block border-l bg-muted/10 flex flex-col overflow-hidden`}>
          <div className="p-3 border-b bg-background">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Orden ({order.items.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Toca productos para agregar a la orden
              </p>
            ) : (
              order.items.map((item) => {
                const isEditable = item.kitchenStatus === "NEW";
                return (
                  <div
                    key={item.id}
                    className={`
                      border rounded-lg bg-background p-2.5 space-y-1.5
                      ${!isEditable ? "opacity-70" : ""}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.note && (
                          <p className="text-[10px] text-amber-700 italic flex items-center gap-1 mt-0.5">
                            <StickyNote className="w-2.5 h-2.5" />
                            {item.note}
                          </p>
                        )}
                        {!isEditable && (
                          <Badge variant="outline" className="text-[9px] mt-0.5">
                            {item.kitchenStatus === "PREPARING" ? "🔥 En cocina" :
                             item.kitchenStatus === "READY" ? "✓ Listo" :
                             item.kitchenStatus === "DELIVERED" ? "✓ Entregado" :
                             item.kitchenStatus}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-bold shrink-0">{fmt(item.subtotalCents)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      {isEditable ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handleItemQtyChange(item, -1)}
                              disabled={pending}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => handleItemQtyChange(item, 1)}
                              disabled={pending}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => handleEditNote(item)}
                            >
                              <StickyNote className="w-3 h-3 mr-1" /> Nota
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                              onClick={() => handleItemDelete(item)}
                              disabled={pending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {item.qty}× a {fmt(item.priceCents)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer con total + botones */}
          {order.items.length > 0 && (
            <div className="border-t bg-background p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{fmt(subtotal)}</span>
              </div>

              {hasNewItems && (
                <Button
                  size="lg"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSendToKitchen}
                  disabled={pending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar a cocina ({newItemsCount})
                </Button>
              )}

              <Button
                size="lg"
                className="w-full h-12 bg-green-600 hover:bg-green-700"
                onClick={handleCheckout}
                disabled={pending || hasNewItems}
                title={hasNewItems ? "Envía los productos a cocina antes de cobrar" : undefined}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Cobrar y cerrar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Long-press / Modificadores */}
      {modifierItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{modifierItem.name}</CardTitle>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setModifierItem(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{fmt(modifierItem.priceCents)} c/u</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase">Cantidad</label>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="lg" variant="outline" className="h-12 w-12" onClick={() => setModifierQty(Math.max(1, modifierQty - 1))}>
                    <Minus className="w-5 h-5" />
                  </Button>
                  <input
                    type="number"
                    min={1}
                    value={modifierQty}
                    onChange={(e) => setModifierQty(parseInt(e.target.value) || 1)}
                    className="w-20 h-12 text-center text-xl font-bold border rounded-lg bg-background"
                  />
                  <Button size="lg" variant="outline" className="h-12 w-12" onClick={() => setModifierQty(modifierQty + 1)}>
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase">Nota / modificadores</label>
                <input
                  type="text"
                  value={modifierNote}
                  onChange={(e) => setModifierNote(e.target.value)}
                  placeholder="ej: sin cebolla, término medio..."
                  className="w-full h-10 px-3 mt-1 border rounded-lg text-sm bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {["Sin cebolla", "Sin chile", "Para llevar", "Sin sal", "Bien cocido", "Término medio"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setModifierNote(modifierNote ? `${modifierNote}, ${preset}` : preset)}
                    className="px-2 py-1.5 text-xs border rounded hover:bg-muted text-left"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total:</span>
                <span className="text-lg font-bold">{fmt(modifierItem.priceCents * modifierQty)}</span>
              </div>

              <Button size="lg" className="w-full h-12" onClick={handleAddWithModifiers} disabled={pending}>
                Agregar a orden
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Editar nota de item existente */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Nota para {editingItem.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                type="text"
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="Nota o modificador..."
                className="w-full h-10 px-3 border rounded-lg bg-background"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                <Button onClick={handleSaveNote} disabled={pending}>Guardar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Checkout */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Cobrar mesa {order.tableName}
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCheckoutOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({order.items.length} productos)</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {tipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Propina</span>
                    <span>{fmt(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-1 border-t">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase">Método de pago</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { v: "CASH" as const, label: "Efectivo", emoji: "💵" },
                    { v: "CARD" as const, label: "Tarjeta", emoji: "💳" },
                    { v: "TRANSFER" as const, label: "Otro", emoji: "📱" },
                  ].map((m) => (
                    <button
                      key={m.v}
                      onClick={() => setPaymentMethod(m.v)}
                      className={`p-3 rounded-lg border-2 text-sm transition ${
                        paymentMethod === m.v ? "border-primary bg-primary/10" : "border-muted hover:bg-muted"
                      }`}
                    >
                      <div className="text-lg">{m.emoji}</div>
                      <div className="font-medium">{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {cashpoints.length > 1 && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase">Caja</label>
                  <select
                    value={cashpointId}
                    onChange={(e) => setCashpointId(e.target.value)}
                    className="w-full h-10 px-3 border rounded-lg bg-background mt-1"
                  >
                    {cashpoints.map((cp) => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground uppercase">Propina (opcional)</label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {[0, 0.10, 0.15, 0.20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setTipAmount(Math.round(subtotal * pct))}
                      className={`p-2 rounded border text-xs ${
                        tipAmount === Math.round(subtotal * pct) ? "border-primary bg-primary/10" : "border-muted"
                      }`}
                    >
                      {pct === 0 ? "Sin" : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full h-14 bg-green-600 hover:bg-green-700 text-base font-bold"
                onClick={handleConfirmCheckout}
                disabled={pending || !cashpointId}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Cobrar {fmt(total)}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

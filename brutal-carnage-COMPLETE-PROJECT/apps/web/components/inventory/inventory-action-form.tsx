// components/inventory/inventory-action-form.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Star } from "lucide-react";

interface Item {
  id: string;
  name: string;
  suggestedPrice: number;
  currentStock: number;
  isFavorited: boolean;
}

interface SelectedExisting {
  itemId: string;
  name: string;
  quantity: number;
}

interface NewItemDraft {
  name: string;
  suggestedPrice: number;
  quantity: number;
}

export function InventoryActionForm({ items, defaultType }: { items: Item[]; defaultType: "DONATE" | "TAKE" | "ORDER" }) {
  const [type, setType] = useState(defaultType);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedExisting[]>([]);
  const [newItems, setNewItems] = useState<NewItemDraft[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredItems = items
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.isFavorited) - Number(a.isFavorited));

  function toggleItem(item: Item) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.itemId === item.id);
      if (exists) return prev.filter((s) => s.itemId !== item.id);
      return [...prev, { itemId: item.id, name: item.name, quantity: 1 }];
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    setSelected((prev) =>
      prev.map((s) => (s.itemId === itemId ? { ...s, quantity: Math.max(1, quantity) } : s))
    );
  }

  function addNewItemDraft() {
    setNewItems((prev) => [...prev, { name: "", suggestedPrice: 0, quantity: 1 }]);
  }

  function updateNewItem(index: number, field: keyof NewItemDraft, value: string | number) {
    setNewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeNewItem(index: number) {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    const validNewItems = newItems.filter((n) => n.name.trim().length >= 2);

    if (selected.length === 0 && validNewItems.length === 0) {
      toast.error("Select at least one item or add a new one.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          existingItems: selected.map((s) => ({ itemId: s.itemId, quantity: s.quantity })),
          newItems: validNewItems,
          note: note || undefined,
        }),
      });
      if (!res.ok) throw new Error();

      toast.success("Submitted for approval");
      setSelected([]);
      setNewItems([]);
      setNote("");
    } catch {
      toast.error("Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex gap-2">
        {(["DONATE", "TAKE", "ORDER"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              type === t
                ? "bg-red-950/50 text-red-300 ring-1 ring-red-800"
                : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items…"
        className="mb-3 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
      />

      <div className="mb-4 max-h-56 space-y-1 overflow-y-auto rounded-md border border-zinc-900 p-2">
        {filteredItems.map((item) => {
          const isSelected = selected.some((s) => s.itemId === item.id);
          const selectedEntry = selected.find((s) => s.itemId === item.id);
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 ${
                isSelected ? "bg-red-950/20" : "hover:bg-zinc-900"
              }`}
            >
              <button
                onClick={() => toggleItem(item)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                {item.isFavorited && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                <span className={isSelected ? "text-red-200" : "text-zinc-300"}>{item.name}</span>
                <span className="text-xs text-zinc-600">stock: {item.currentStock}</span>
              </button>
              {isSelected && selectedEntry && (
                <input
                  type="number"
                  min={1}
                  value={selectedEntry.quantity}
                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                  className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-right text-xs text-zinc-200"
                />
              )}
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-600">No items match.</p>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-zinc-500">New items</span>
          <button
            onClick={addNewItemDraft}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
          >
            <Plus className="h-3.5 w-3.5" /> Add new item
          </button>
        </div>

        {newItems.map((draft, i) => (
          <div key={i} className="mb-2 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-2">
            <input
              value={draft.name}
              onChange={(e) => updateNewItem(i, "name", e.target.value)}
              placeholder="Item name"
              className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              type="number"
              value={draft.suggestedPrice || ""}
              onChange={(e) => updateNewItem(i, "suggestedPrice", parseFloat(e.target.value) || 0)}
              placeholder="Suggested price"
              className="w-28 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
            />
            <input
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) => updateNewItem(i, "quantity", parseInt(e.target.value) || 1)}
              className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
            />
            <button onClick={() => removeNewItem(i)} className="text-zinc-600 hover:text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {newItems.length > 0 && (
          <p className="text-xs text-zinc-600">
            New items go to pending approval — stock is only credited once a Business Manager+ approves.
          </p>
        )}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Add context for reviewers… (optional)"
        className="mb-4 w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-md bg-gradient-to-b from-red-600 to-red-700 py-2.5 text-sm font-medium text-white transition-shadow hover:shadow-glow-crimson disabled:opacity-50"
      >
        {submitting ? "Submitting…" : `Submit ${type.toLowerCase()} request`}
      </button>
    </div>
  );
}

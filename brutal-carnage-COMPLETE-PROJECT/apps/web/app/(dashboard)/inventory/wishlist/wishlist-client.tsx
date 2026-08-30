// app/(dashboard)/inventory/wishlist/wishlist-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";

interface WishlistEntry {
  id: string;
  itemId: string;
  name: string;
  suggestedPrice: number;
  currentStock: number;
  quantity: number;
}
interface ItemOption {
  id: string;
  name: string;
}

export function WishlistClient({ wishlist, items }: { wishlist: WishlistEntry[]; items: ItemOption[] }) {
  const router = useRouter();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  async function addToWishlist() {
    if (!selectedItemId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItemId, quantity }),
      });
      if (!res.ok) throw new Error();
      toast.success("Added to wishlist");
      setSelectedItemId("");
      setQuantity(1);
      router.refresh();
    } catch {
      toast.error("Couldn't add item");
    } finally {
      setBusy(false);
    }
  }

  async function removeFromWishlist(itemId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Couldn't remove item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-panel-border bg-panel/70 p-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Item</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          >
            <option value="">Select item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Qty</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        <button
          onClick={addToWishlist}
          disabled={busy || !selectedItemId}
          className="flex items-center gap-2 rounded-md bg-gradient-to-b from-red-600 to-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </div>

      <div className="space-y-2">
        {wishlist.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg border border-panel-border bg-panel/70 p-4">
            <div>
              <p className="text-sm text-zinc-200">{w.name} × {w.quantity}</p>
              <p className="text-xs text-zinc-500">${w.suggestedPrice.toLocaleString()} each · {w.currentStock} currently in stock</p>
            </div>
            <button
              onClick={() => removeFromWishlist(w.itemId)}
              className="rounded-md border border-panel-border p-2 text-zinc-500 hover:bg-white/[0.04] hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {wishlist.length === 0 && <p className="text-sm text-zinc-600">Your wishlist is empty.</p>}
      </div>
    </div>
  );
}

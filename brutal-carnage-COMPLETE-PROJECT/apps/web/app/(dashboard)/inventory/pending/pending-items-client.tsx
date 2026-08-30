// app/(dashboard)/inventory/pending/pending-items-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2, Pencil, CheckCheck } from "lucide-react";

interface PendingItemEntry {
  id: string;
  name: string;
  suggestedPrice: number;
  quantity: number;
  reason: string | null;
  submittedBy: string;
  createdAt: string;
}

export function PendingItemsClient({ items }: { items: PendingItemEntry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  function startEdit(item: PendingItemEntry) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.suggestedPrice));
  }

  async function review(id: string, approve: boolean, overrides?: { name?: string; suggestedPrice?: number }) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/pending-items/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, ...overrides }),
      });
      if (!res.ok) throw new Error();
      toast.success(approve ? "Item approved and added to stock" : "Item rejected");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkReview(ids: string[], approve: boolean) {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/pending-items/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, approve }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`${approve ? "Approved" : "Rejected"} ${data.reviewed} item(s)${data.failed ? `, ${data.failed} failed` : ""}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-600">Nothing waiting on approval.</p>;
  }

  const allSelected = selected.size === items.length && items.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-zinc-700 bg-zinc-900" />
          Select all ({items.length})
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => bulkReview(Array.from(selected), true)}
            disabled={bulkBusy || selected.size === 0}
            className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Approve selected ({selected.size})
          </button>
          <button
            onClick={() => bulkReview(Array.from(selected), false)}
            disabled={bulkBusy || selected.size === 0}
            className="flex items-center gap-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" /> Reject selected ({selected.size})
          </button>
          <button
            onClick={() => bulkReview(items.map((i) => i.id), true)}
            disabled={bulkBusy}
            className="flex items-center gap-1 rounded-md border border-amber-800 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-950/60 disabled:opacity-40"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Approve all
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggleSelected(item.id)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              <div>
                {editingId === item.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      placeholder="Item name"
                    />
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      type="number"
                      min="0"
                      className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      placeholder="Price"
                    />
                    <span className="text-xs text-zinc-500">× {item.quantity}</span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-200">
                    <span className="font-medium">{item.name}</span> × {item.quantity} — ${item.suggestedPrice.toLocaleString()} each
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  Submitted by {item.submittedBy}{item.reason && ` — "${item.reason}"`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {editingId === item.id ? (
                <>
                  <button
                    onClick={() =>
                      review(item.id, true, {
                        name: editName.trim() || undefined,
                        suggestedPrice: editPrice ? Number(editPrice) : undefined,
                      })
                    }
                    disabled={busyId === item.id}
                    className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
                  >
                    {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save & approve
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(item)}
                    className="flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => review(item.id, true)}
                    disabled={busyId === item.id}
                    className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
                  >
                    {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => review(item.id, false)}
                    disabled={busyId === item.id}
                    className="flex items-center gap-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

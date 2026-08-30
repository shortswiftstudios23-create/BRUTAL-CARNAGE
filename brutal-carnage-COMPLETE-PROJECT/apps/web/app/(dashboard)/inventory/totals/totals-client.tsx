// app/(dashboard)/inventory/totals/totals-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Pencil, Check, X, Loader2 } from "lucide-react";

interface Row {
  id: string;
  name: string;
  suggestedPrice: number;
  totalAdded: number;
  entryCount: number;
}

export function TotalsClient({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const totalPiecesAdded = rows.reduce((sum, r) => sum + r.totalAdded, 0);
  const totalValueAdded = rows.reduce((sum, r) => sum + r.totalAdded * r.suggestedPrice, 0);

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditPrice(String(row.suggestedPrice));
  }

  async function save(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), suggestedPrice: Number(editPrice) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.formErrors?.[0] ?? data.error ?? "Couldn't save");
        return;
      }
      toast.success("Item updated");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        <p className="text-xs text-zinc-500">
          {totalPiecesAdded.toLocaleString()} pieces added all-time · ${totalValueAdded.toLocaleString()} total value
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-border">
        <table className="w-full text-sm">
          <thead className="bg-panel/90 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">Total added (all-time)</th>
              <th className="px-4 py-2 text-right">Donation entries</th>
              {canEdit && <th className="px-4 py-2 text-right">Edit</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className="bg-panel/50">
                  <td className="px-4 py-2 text-zinc-200">
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-panel-border bg-white/[0.03] px-2 py-1 text-sm text-zinc-200 focus:border-red-800 focus:outline-none"
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-24 rounded border border-panel-border bg-white/[0.03] px-2 py-1 text-right text-sm text-zinc-200 focus:border-red-800 focus:outline-none"
                      />
                    ) : (
                      `$${row.suggestedPrice.toLocaleString()}`
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-200">{row.totalAdded.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">{row.entryCount.toLocaleString()}</td>
                  {canEdit && (
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => save(row.id)}
                            disabled={busy}
                            className="rounded p-1 text-green-400 hover:bg-green-950/40 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 text-zinc-400 hover:bg-white/[0.04]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className="rounded p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-zinc-600">
                  No items match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

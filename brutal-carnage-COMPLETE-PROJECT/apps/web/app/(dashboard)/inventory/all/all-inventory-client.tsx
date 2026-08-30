// app/(dashboard)/inventory/all/all-inventory-client.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";

interface ItemRow {
  id: string;
  name: string;
  suggestedPrice: number;
  currentStock: number;
  category: string | null;
}

type SortKey = "name" | "currentStock" | "suggestedPrice" | "worth";

export function AllInventoryClient({ items }: { items: ItemRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? items.filter((i) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q))
      : items;

    const sorted = [...rows].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "worth") {
        av = a.suggestedPrice * a.currentStock;
        bv = b.suggestedPrice * b.currentStock;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });

    return sorted;
  }, [items, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const totalWorth = items.reduce((sum, i) => sum + i.suggestedPrice * i.currentStock, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or category…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        <p className="text-xs text-zinc-500">
          {items.length} item{items.length !== 1 ? "s" : ""} · ${totalWorth.toLocaleString()} total worth
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <SortableHeader label="Item" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <th className="px-4 py-2 text-left">Category</th>
              <SortableHeader label="In stock" active={sortKey === "currentStock"} dir={sortDir} onClick={() => toggleSort("currentStock")} align="right" />
              <SortableHeader label="Unit price" active={sortKey === "suggestedPrice"} dir={sortDir} onClick={() => toggleSort("suggestedPrice")} align="right" />
              <SortableHeader label="Total worth" active={sortKey === "worth"} dir={sortDir} onClick={() => toggleSort("worth")} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((item) => (
              <tr key={item.id} className="bg-zinc-950/40">
                <td className="px-4 py-2 text-zinc-200">{item.name}</td>
                <td className="px-4 py-2 text-zinc-500">{item.category ?? "—"}</td>
                <td className={`px-4 py-2 text-right ${item.currentStock <= 5 ? "text-red-400" : "text-zinc-300"}`}>
                  {item.currentStock}
                </td>
                <td className="px-4 py-2 text-right text-zinc-300">${item.suggestedPrice.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-zinc-200">
                  ${(item.suggestedPrice * item.currentStock).toLocaleString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">
                  No items match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-zinc-300 ${active ? "text-zinc-300" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

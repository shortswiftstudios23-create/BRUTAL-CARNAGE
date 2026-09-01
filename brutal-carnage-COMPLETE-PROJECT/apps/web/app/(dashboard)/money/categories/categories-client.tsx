// app/(dashboard)/money/categories/categories-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, EyeOff, Eye, ChevronDown } from "lucide-react";

type Direction = "INCOME" | "EXPENSE";

interface Category {
  id: string;
  name: string;
  direction: Direction;
  group: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
}

const formSchema = z.object({
  name: z.string().trim().min(2, "Too short").max(60),
  direction: z.enum(["INCOME", "EXPENSE"]),
  group: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(10).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const UNGROUPED = "Other";

export function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { direction: "EXPENSE" },
  });

  // Group categories for a scannable list instead of one long flat table.
  const grouped = useMemo(() => {
    const visible = categories.filter((c) => showInactive || c.isActive);
    const byGroup = new Map<string, Category[]>();
    for (const c of visible) {
      const key = c.group || UNGROUPED;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(c);
    }
    return Array.from(byGroup.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [categories, showInactive]);

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't create category");
        return;
      }
      setCategories((prev) => [...prev, { ...data.category, usageCount: 0 }]);
      toast.success(`Added "${values.name}"`);
      reset({ direction: "EXPENSE" });
      setShowAddForm(false);
    } catch {
      toast.error("Couldn't create category. Try again.");
    }
  }

  async function toggleActive(cat: Category) {
    setBusyId(cat.id);
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) throw new Error();
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
      );
      toast.success(cat.isActive ? `"${cat.name}" hidden from new transactions` : `"${cat.name}" reactivated`);
    } catch {
      toast.error("Couldn't update. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function hardDelete(cat: Category) {
    if (cat.usageCount > 0) {
      toast.error(`Used on ${cat.usageCount} transaction${cat.usageCount === 1 ? "" : "s"} — deactivate instead of deleting.`);
      return;
    }
    if (!confirm(`Permanently delete "${cat.name}"? This can't be undone.`)) return;
    setBusyId(cat.id);
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't delete");
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success(`Deleted "${cat.name}"`);
    } catch {
      toast.error("Couldn't delete. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row: count + toggle inactive + add button, all in one line */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">
            {categories.filter((c) => c.isActive).length} active categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          >
            {showInactive ? "Hide inactive" : "Show inactive"}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-red-600 to-red-700 px-3 py-1.5 text-xs font-medium text-white hover:shadow-glow-crimson"
          >
            <Plus className="h-3.5 w-3.5" />
            New category
          </button>
        </div>
      </div>

      {/* Add form — collapsed by default so the page opens clean, not busy */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Name</label>
              <input
                {...register("name")}
                placeholder="e.g. License Plate"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Direction</label>
              <select
                {...register("direction")}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              >
                <option value="EXPENSE">Expense (money out)</option>
                <option value="INCOME">Income (money in)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                Group <span className="text-zinc-700">(optional)</span>
              </label>
              <input
                {...register("group")}
                placeholder="e.g. Vehicles, House, Business"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                Icon <span className="text-zinc-700">(optional emoji)</span>
              </label>
              <input
                {...register("icon")}
                placeholder="🚗"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-gradient-to-b from-red-600 to-red-700 px-4 py-1.5 text-xs font-medium text-white hover:shadow-glow-crimson disabled:opacity-50"
            >
              {isSubmitting ? "Adding…" : "Add category"}
            </button>
          </div>
        </form>
      )}

      {/* Grouped list */}
      <div className="space-y-4">
        {grouped.map(([groupName, cats]) => (
          <div key={groupName} className="rounded-lg border border-zinc-800 bg-zinc-950/40">
            <div className="border-b border-zinc-800 px-4 py-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{groupName}</h3>
            </div>
            <ul className="divide-y divide-zinc-900">
              {cats.map((cat) => (
                <li
                  key={cat.id}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                    !cat.isActive ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {cat.icon && <span className="text-sm">{cat.icon}</span>}
                    <span className="truncate text-sm text-zinc-200">{cat.name}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        cat.direction === "INCOME"
                          ? "bg-emerald-950/50 text-emerald-400"
                          : "bg-red-950/50 text-red-400"
                      }`}
                    >
                      {cat.direction === "INCOME" ? "In" : "Out"}
                    </span>
                    {cat.usageCount > 0 && (
                      <span className="shrink-0 text-[10px] text-zinc-600">{cat.usageCount} used</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleActive(cat)}
                      disabled={busyId === cat.id}
                      title={cat.isActive ? "Deactivate (hide from new transactions)" : "Reactivate"}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {cat.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => hardDelete(cat)}
                      disabled={busyId === cat.id}
                      title={cat.usageCount > 0 ? "In use — deactivate instead" : "Delete permanently"}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-600">
            No categories yet. Add one to get started.
          </p>
        )}
      </div>
    </div>
  );
}

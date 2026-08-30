// app/(dashboard)/rules/rules-client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GripVertical, Trash2, Plus, Loader2, ScrollText, Pencil, Check } from "lucide-react";

interface RuleRow {
  id?: string;
  order: number;
  title: string;
  content: string;
}

export function RulesClient({ canEdit, initialRules }: { canEdit: boolean; initialRules: RuleRow[] }) {
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function update(index: number, patch: Partial<RuleRow>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRule() {
    setRules((prev) => [...prev, { order: prev.length, title: "New rule", content: "Describe the rule…" }]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i })));
  }

  function onDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    setRules((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next.map((r, i) => ({ ...r, order: i }));
    });
    setDragIndex(null);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.rules.map((r: any) => ({ id: r.id, order: r.order, title: r.title, content: r.content })));
      toast.success("Rules updated.");
      setEditing(false);
    } catch {
      toast.error("Failed to save rules.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400">
          <ScrollText className="h-4 w-4" />
          <span className="text-sm">Every member is expected to know these.</span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing && (
              <button
                onClick={addRule}
                className="flex items-center gap-1.5 rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add rule
              </button>
            )}
            <button
              onClick={() => (editing ? save() : setEditing(true))}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Save rules" : "Edit rules"}
            </button>
          </div>
        )}
      </div>

      {rules.length === 0 && !editing && (
        <div className="rounded-lg border border-panel-border bg-panel/70 p-10 text-center text-sm text-zinc-600">
          No rules published yet.
        </div>
      )}

      <ol className="space-y-3">
        {rules.map((rule, i) => (
          <li
            key={rule.id ?? `new-${i}`}
            draggable={editing}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex gap-3 rounded-lg border border-panel-border bg-panel/70 p-4"
          >
            {editing && <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-zinc-600" />}
            <span className="mt-0.5 shrink-0 font-display text-sm text-red-400">{i + 1}.</span>
            <div className="flex-1">
              {editing ? (
                <>
                  <input
                    value={rule.title}
                    onChange={(e) => update(i, { title: e.target.value })}
                    className="mb-2 w-full rounded-md border border-panel-border bg-white/[0.03] px-2 py-1 text-sm font-medium text-zinc-100 focus:border-red-800 focus:outline-none"
                  />
                  <textarea
                    value={rule.content}
                    onChange={(e) => update(i, { content: e.target.value })}
                    rows={2}
                    className="w-full resize-none rounded-md border border-panel-border bg-white/[0.03] px-2 py-1 text-sm text-zinc-400 focus:border-red-800 focus:outline-none"
                  />
                </>
              ) : (
                <>
                  <p className="font-medium text-zinc-100">{rule.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{rule.content}</p>
                </>
              )}
            </div>
            {editing && (
              <button
                onClick={() => removeRule(i)}
                className="h-fit shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-red-950 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

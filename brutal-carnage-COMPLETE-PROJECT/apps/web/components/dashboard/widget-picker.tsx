// components/dashboard/widget-picker.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X, GripVertical, Loader2, Settings2, Star } from "lucide-react";
import { WIDGET_REGISTRY } from "@/lib/widgets";

interface WidgetPref {
  id: string;
  enabled: boolean;
  order: number;
}

export function WidgetPicker({
  initialPrefs,
  canSetFamilyDefault,
}: {
  initialPrefs: WidgetPref[];
  canSetFamilyDefault: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<WidgetPref[]>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function toggle(id: string) {
    setPrefs((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  }

  function onDrop(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    setPrefs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next.map((p, i) => ({ ...p, order: i }));
    });
    setDragIndex(null);
  }

  async function save(setAsFamilyDefault: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/widgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: prefs, setAsFamilyDefault }),
      });
      if (!res.ok) throw new Error();
      toast.success(setAsFamilyDefault ? "Saved as the family default layout." : "Dashboard layout saved.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to save layout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Customize
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-panel-border bg-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">Customize dashboard</h3>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-xs text-zinc-500">Drag to reorder, toggle to show/hide.</p>

            <ul className="mb-5 max-h-80 space-y-2 overflow-y-auto">
              {prefs.map((pref, i) => {
                const def = WIDGET_REGISTRY.find((w) => w.id === pref.id);
                if (!def) return null;
                return (
                  <li
                    key={pref.id}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(i)}
                    className="flex items-center gap-3 rounded-md border border-panel-border bg-white/[0.03] px-3 py-2"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{def.label}</p>
                      <p className="truncate text-xs text-zinc-600">{def.description}</p>
                    </div>
                    <button
                      onClick={() => toggle(pref.id)}
                      className={`h-5 w-9 shrink-0 rounded-full transition-colors ${
                        pref.enabled ? "bg-red-700" : "bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform ${
                          pref.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-2">
              {canSetFamilyDefault ? (
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
                  title="Boss+: make this the default every member starts with"
                >
                  <Star className="h-3.5 w-3.5" />
                  Set as family default
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save layout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

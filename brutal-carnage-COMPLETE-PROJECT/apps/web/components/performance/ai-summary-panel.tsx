// components/performance/ai-summary-panel.tsx
"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AiSummaryPanel({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/${userId}/summary`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      toast.error("Couldn't generate a summary right now");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-red-400" />
          AI performance summary
        </h3>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {summary ? "Regenerate" : "Generate"}
        </button>
      </div>
      {summary ? (
        <p className="text-sm leading-relaxed text-zinc-300">{summary}</p>
      ) : (
        <p className="text-sm text-zinc-600">Generate a short AI-written summary grounded in real stats below.</p>
      )}
    </div>
  );
}

// app/(dashboard)/inventory/pending/pending-items-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";

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

  async function review(id: string, approve: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/pending-items/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      if (!res.ok) throw new Error();
      toast.success(approve ? "Item approved and added to stock" : "Item rejected");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-600">Nothing waiting on approval.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-200">
              <span className="font-medium">{item.name}</span> × {item.quantity} — ${item.suggestedPrice.toLocaleString()} each
            </p>
            <p className="text-xs text-zinc-500">
              Submitted by {item.submittedBy}{item.reason && ` — "${item.reason}"`}
            </p>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      ))}
    </div>
  );
}

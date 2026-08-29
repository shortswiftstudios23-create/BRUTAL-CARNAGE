// app/(dashboard)/promotions/promotions-client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, ArrowUpCircle } from "lucide-react";

interface Request {
  id: string;
  username: string;
  fromRank: string;
  toRank: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statsSnapshot: Record<string, unknown>;
  createdAt: string;
  isOwn: boolean;
}

export function PromotionsClient({
  requests,
  canReview,
  canRequest,
  nextRank,
}: {
  requests: Request[];
  canReview: boolean;
  canRequest: boolean;
  nextRank: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const hasPending = requests.some((r) => r.isOwn && r.status === "PENDING");

  async function submitRequest() {
    if (!nextRank) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toRank: nextRank }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed");
      }
      toast.success("Promotion request submitted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit the request");
    } finally {
      setSubmitting(false);
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/promotions/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success(action === "approve" ? "Promotion approved" : "Request rejected");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canRequest && !canReview && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
          <h2 className="mb-1 text-sm font-medium text-zinc-200">Request a promotion</h2>
          {nextRank ? (
            <>
              <p className="mb-3 text-sm text-zinc-500">
                Submit a request to move up to <span className="text-zinc-300">{nextRank.replace(/_/g, " ")}</span>.
                Your current stats will be attached automatically.
              </p>
              <button
                onClick={submitRequest}
                disabled={submitting || hasPending}
                className="flex items-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 px-4 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)] disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <ArrowUpCircle className="h-4 w-4" />
                {hasPending ? "Request pending" : "Request promotion"}
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-600">You're already at the top rank.</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-medium text-zinc-200">
            {canReview ? "All promotion requests" : "Your promotion requests"}
          </h2>
        </div>
        {requests.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {requests.map((r) => (
              <li key={r.id} className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-zinc-200">
                    {r.username} — {r.fromRank.replace(/_/g, " ")} →{" "}
                    <span className="text-red-400">{r.toRank.replace(/_/g, " ")}</span>
                  </p>
                  <StatusPill status={r.status} />
                </div>
                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  {"totalDonated" in r.statsSnapshot && (
                    <span>Donated: ${Number(r.statsSnapshot.totalDonated).toLocaleString()}</span>
                  )}
                  {"eventsAttended" in r.statsSnapshot && <span>Events attended: {String(r.statsSnapshot.eventsAttended)}</span>}
                  {"strikeCount" in r.statsSnapshot && <span>Strikes: {String(r.statsSnapshot.strikeCount)}</span>}
                </div>
                {canReview && r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(r.id, "approve")}
                      disabled={reviewingId === r.id}
                      className="flex items-center gap-1.5 rounded-md border border-green-800 px-3 py-1.5 text-xs text-green-300 hover:bg-green-950/30 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => review(r.id, "reject")}
                      disabled={reviewingId === r.id}
                      className="flex items-center gap-1.5 rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Request["status"] }) {
  const map = {
    PENDING: "border-amber-800 bg-amber-950/40 text-amber-300",
    APPROVED: "border-green-800 bg-green-950/40 text-green-300",
    REJECTED: "border-red-900 bg-red-950/40 text-red-400",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}

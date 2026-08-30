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
  reviewerCanApprove: boolean;
}

export function PromotionsClient({
  requests,
  canReview,
  canRequest,
  eligibleRanks,
}: {
  requests: Request[];
  canReview: boolean;
  canRequest: boolean;
  eligibleRanks: string[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState(eligibleRanks[0] ?? "");
  const [reason, setReason] = useState("");

  const hasPending = requests.some((r) => r.isOwn && r.status === "PENDING");

  async function submitRequest() {
    if (!selectedRank || !reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toRank: selectedRank, reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed");
      }
      toast.success("Promotion request submitted");
      setReason("");
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
      {canRequest && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:p-5">
          <h2 className="mb-1 text-sm font-medium text-zinc-200">Request a promotion</h2>
          {eligibleRanks.length > 0 ? (
            <>
              <p className="mb-3 text-sm text-zinc-500">
                Anyone can request any rank above their own — pick the rank you're asking for.
                Your current stats will be attached automatically.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <select
                  value={selectedRank}
                  onChange={(e) => setSelectedRank(e.target.value)}
                  disabled={submitting || hasPending}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800 disabled:opacity-50 sm:w-auto"
                >
                  {eligibleRanks.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting || hasPending}
                  placeholder="Why do you deserve this promotion?"
                  rows={2}
                  maxLength={500}
                  className="w-full flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800 disabled:opacity-50"
                />
                <button
                  onClick={submitRequest}
                  disabled={submitting || hasPending || !reason.trim()}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 px-4 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <ArrowUpCircle className="h-4 w-4" />
                  {hasPending ? "Request pending" : "Request promotion"}
                </button>
              </div>
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
              <li key={r.id} className="p-4 sm:p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => review(r.id, "approve")}
                      disabled={reviewingId === r.id || !r.reviewerCanApprove}
                      title={r.reviewerCanApprove ? undefined : "Your rank can't approve a promotion this high"}
                      className="flex items-center gap-1.5 rounded-md border border-green-800 px-3 py-1.5 text-xs text-green-300 hover:bg-green-950/30 disabled:cursor-not-allowed disabled:opacity-40"
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
                    {!r.reviewerCanApprove && (
                      <span className="text-[11px] text-zinc-600">Needs a higher rank to approve</span>
                    )}
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

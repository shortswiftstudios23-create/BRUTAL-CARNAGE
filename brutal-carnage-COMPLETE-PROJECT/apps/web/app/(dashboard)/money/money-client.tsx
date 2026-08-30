// app/(dashboard)/money/money-client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Loader2, ReceiptText } from "lucide-react";

interface PendingTransaction {
  id: string;
  username: string;
  rank: string;
  type: string;
  originalAmount: number;
  taxAmount: number;
  finalAmount: number;
  note: string | null;
  soldItemName: string | null;
  soldQuantity: number | null;
  createdAt: string;
}

interface PendingBankRequest {
  id: string;
  username: string;
  rank: string;
  amount: number;
  reason: string;
  createdAt: string;
}

function formatType(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function MoneyClient({
  canApprove,
  canApproveBank,
  pendingTransactions,
  pendingBankRequests,
  myPendingRequestsCount,
}: {
  canApprove: boolean;
  canApproveBank: boolean;
  pendingTransactions: PendingTransaction[];
  pendingBankRequests: PendingBankRequest[];
  myPendingRequestsCount: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reviewTransaction(id: string, approve: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(
        approve ? `/api/transactions/${id}/approve` : `/api/transactions/${id}/reject`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      if (!res.ok) throw new Error();
      toast.success(approve ? "Transaction approved" : "Transaction rejected");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewBankRequest(id: string, approve: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/bank-requests/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Action failed");
      }
      toast.success(approve ? "Bank request approved" : "Bank request declined");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!canApprove && !canApproveBank && myPendingRequestsCount === 0) {
    return (
      <div className="mt-6">
        <Link
          href="/money/history"
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ReceiptText className="h-4 w-4" /> View full transaction history →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {!canApprove && !canApproveBank && myPendingRequestsCount > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
          You have {myPendingRequestsCount} bank request{myPendingRequestsCount !== 1 ? "s" : ""} awaiting approval.
        </div>
      )}

      {canApprove && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-200">
            Pending transactions {pendingTransactions.length > 0 && `(${pendingTransactions.length})`}
          </h2>
          {pendingTransactions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing waiting on review.</p>
          ) : (
            <div className="space-y-2">
              {pendingTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-zinc-200">
                      <span className="font-medium">{t.username}</span> · {formatType(t.type)}
                      {t.soldItemName && ` · ${t.soldQuantity}× ${t.soldItemName}`}
                    </p>
                    <p className="text-xs text-zinc-500">
                      ${t.originalAmount.toLocaleString()}
                      {t.taxAmount > 0 && ` (tax $${t.taxAmount.toLocaleString()} → $${t.finalAmount.toLocaleString()})`}
                      {t.note && ` — "${t.note}"`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewTransaction(t.id, true)}
                      disabled={busyId === t.id}
                      className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
                    >
                      {busyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => reviewTransaction(t.id, false)}
                      disabled={busyId === t.id}
                      className="flex items-center gap-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canApproveBank && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-200">
            Pending bank requests {pendingBankRequests.length > 0 && `(${pendingBankRequests.length})`}
          </h2>
          {pendingBankRequests.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing waiting on review.</p>
          ) : (
            <div className="space-y-2">
              {pendingBankRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-zinc-200">
                      <span className="font-medium">{r.username}</span> requests ${r.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">"{r.reason}"</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewBankRequest(r.id, true)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
                    >
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => reviewBankRequest(r.id, false)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Link href="/money/history" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
        <ReceiptText className="h-4 w-4" /> View full transaction history →
      </Link>
    </div>
  );
}

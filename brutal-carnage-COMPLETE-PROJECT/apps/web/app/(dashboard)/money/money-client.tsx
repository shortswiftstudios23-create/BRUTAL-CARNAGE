// app/(dashboard)/money/money-client.tsx
"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";

export function MoneyClient({
  canApprove,
  canApproveBank,
  pendingTransactionCount,
  pendingBankRequestCount,
  myPendingRequestsCount,
}: {
  canApprove: boolean;
  canApproveBank: boolean;
  pendingTransactionCount: number;
  pendingBankRequestCount: number;
  myPendingRequestsCount: number;
}) {
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
    <div className="mt-8 space-y-4">
      {!canApprove && !canApproveBank && myPendingRequestsCount > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
          You have {myPendingRequestsCount} bank request{myPendingRequestsCount !== 1 ? "s" : ""} awaiting approval.
        </div>
      )}

      {(canApprove || canApproveBank) && (
        <Link
          href="/admin"
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
        >
          <span>
            {pendingTransactionCount + pendingBankRequestCount > 0
              ? `${pendingTransactionCount + pendingBankRequestCount} item${
                  pendingTransactionCount + pendingBankRequestCount === 1 ? "" : "s"
                } waiting for review`
              : "Nothing waiting for review right now"}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">Review in admin panel →</span>
        </Link>
      )}

      <Link href="/money/history" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
        <ReceiptText className="h-4 w-4" /> View full transaction history →
      </Link>
    </div>
  );
}

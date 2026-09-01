// app/(dashboard)/admin/admin-panel-client.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2, PackagePlus, PackageMinus, Wallet, Landmark, HandCoins, Banknote } from "lucide-react";

interface PendingItem {
  id: string;
  name: string;
  suggestedPrice: number;
  quantity: number;
  reason: string | null;
  submittedBy: string;
  createdAt: string;
}

interface PendingItemAction {
  id: string;
  type: string; // DONATE | TAKE | ORDER
  itemName: string;
  quantity: number;
  note: string | null;
  username: string;
  createdAt: string;
}

interface PendingTransaction {
  id: string;
  username: string;
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
  amount: number;
  reason: string;
  createdAt: string;
}

interface PendingLoan {
  id: string;
  username: string;
  principal: number;
  interestRate: number;
  reason: string | null;
  durationDays: number | null;
  collateralItems: string | null;
  collateralValue: number | null;
  createdAt: string;
}

interface PendingReimbursement {
  id: string;
  username: string;
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

function SectionShell({
  icon: Icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-red-400" />
        <h2 className="text-sm font-medium text-zinc-200">
          {title} {count > 0 && <span className="text-zinc-500">({count})</span>}
        </h2>
      </div>
      {count === 0 ? <p className="text-sm text-zinc-600">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function Row({
  children,
  onApprove,
  onReject,
  busy,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: {
  children: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>{children}</div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onApprove}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {approveLabel}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/60 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> {rejectLabel}
        </button>
      </div>
    </div>
  );
}

export function AdminPanelClient({
  canApprovePendingItems,
  canApproveItemActions,
  canApproveTransactions,
  canApproveBankRequests,
  canApproveLoans,
  pendingItems,
  pendingItemActions,
  pendingTransactions,
  pendingBankRequests,
  pendingLoans,
  pendingReimbursements,
}: {
  canApprovePendingItems: boolean;
  canApproveItemActions: boolean;
  canApproveTransactions: boolean;
  canApproveBankRequests: boolean;
  canApproveLoans: boolean;
  pendingItems: PendingItem[];
  pendingItemActions: PendingItemAction[];
  pendingTransactions: PendingTransaction[];
  pendingBankRequests: PendingBankRequest[];
  pendingLoans: PendingLoan[];
  pendingReimbursements: PendingReimbursement[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function call(url: string, body: object, successMsg: string, id: string) {
    setBusyId(id);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Action failed");
      }
      toast.success(successMsg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const totalPending =
    pendingItems.length + pendingItemActions.length + pendingTransactions.length + pendingBankRequests.length + pendingLoans.length + pendingReimbursements.length;

  if (
    !canApprovePendingItems &&
    !canApproveItemActions &&
    !canApproveTransactions &&
    !canApproveBankRequests &&
    !canApproveLoans
  ) {
    return <p className="text-sm text-zinc-500">You don't have approval permissions for anything here.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        {totalPending === 0
          ? "Nothing waiting on a decision right now."
          : `${totalPending} item${totalPending !== 1 ? "s" : ""} waiting across the family.`}
      </p>

      {canApprovePendingItems && (
        <SectionShell icon={PackagePlus} title="New item requests" count={pendingItems.length} empty="No new items awaiting approval.">
          {pendingItems.map((item) => (
            <Row
              key={item.id}
              busy={busyId === item.id}
              onApprove={() => call(`/api/pending-items/${item.id}/review`, { approve: true }, "Item approved and added to stock", item.id)}
              onReject={() => call(`/api/pending-items/${item.id}/review`, { approve: false }, "Item rejected", item.id)}
            >
              <p className="text-sm text-zinc-200">
                <span className="font-medium">{item.name}</span> × {item.quantity} — ${item.suggestedPrice.toLocaleString()} each
              </p>
              <p className="text-xs text-zinc-500">
                Submitted by {item.submittedBy}
                {item.reason && ` — "${item.reason}"`}
              </p>
            </Row>
          ))}
        </SectionShell>
      )}

      {canApproveItemActions && (
        <SectionShell
          icon={PackageMinus}
          title="Item donate / take / order actions"
          count={pendingItemActions.length}
          empty="No item actions awaiting approval."
        >
          {pendingItemActions.map((a) => (
            <Row
              key={a.id}
              busy={busyId === a.id}
              onApprove={() => call(`/api/item-actions/${a.id}/review`, { approve: true }, "Item action approved", a.id)}
              onReject={() => call(`/api/item-actions/${a.id}/review`, { approve: false }, "Item action rejected", a.id)}
            >
              <p className="text-sm text-zinc-200">
                <span className="font-medium">{a.username}</span> · {formatType(a.type)} · {a.quantity}× {a.itemName}
              </p>
              {a.note && <p className="text-xs text-zinc-500">"{a.note}"</p>}
            </Row>
          ))}
        </SectionShell>
      )}

      {canApproveTransactions && (
        <SectionShell icon={Wallet} title="Money transactions" count={pendingTransactions.length} empty="No transactions awaiting approval.">
          {pendingTransactions.map((t) => (
            <Row
              key={t.id}
              busy={busyId === t.id}
              onApprove={() => call(`/api/transactions/${t.id}/approve`, {}, "Transaction approved", t.id)}
              onReject={() => call(`/api/transactions/${t.id}/reject`, {}, "Transaction rejected", t.id)}
            >
              <p className="text-sm text-zinc-200">
                <span className="font-medium">{t.username}</span> · {formatType(t.type)}
                {t.soldItemName && ` · ${t.soldQuantity}× ${t.soldItemName}`}
              </p>
              <p className="text-xs text-zinc-500">
                ${t.originalAmount.toLocaleString()}
                {t.taxAmount > 0 && ` (tax $${t.taxAmount.toLocaleString()} → $${t.finalAmount.toLocaleString()})`}
                {t.note && ` — "${t.note}"`}
              </p>
            </Row>
          ))}
        </SectionShell>
      )}

      {canApproveBankRequests && (
        <SectionShell icon={Landmark} title="Bank withdrawal requests" count={pendingBankRequests.length} empty="No bank requests awaiting approval.">
          {pendingBankRequests.map((r) => (
            <Row
              key={r.id}
              busy={busyId === r.id}
              approveLabel="Approve"
              rejectLabel="Decline"
              onApprove={() => call(`/api/bank-requests/${r.id}/review`, { approve: true }, "Bank request approved", r.id)}
              onReject={() => call(`/api/bank-requests/${r.id}/review`, { approve: false }, "Bank request declined", r.id)}
            >
              <p className="text-sm text-zinc-200">
                <span className="font-medium">{r.username}</span> requests ${r.amount.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">"{r.reason}"</p>
            </Row>
          ))}
        </SectionShell>
      )}

      {canApproveLoans && (
        <SectionShell icon={HandCoins} title="Loan requests" count={pendingLoans.length} empty="No loan requests awaiting approval.">
          {pendingLoans.map((l) => (
            <Row
              key={l.id}
              busy={busyId === l.id}
              approveLabel="Approve"
              rejectLabel="Decline"
              onApprove={() => call(`/api/loans/${l.id}/review`, { approve: true }, "Loan approved and paid out", l.id)}
              onReject={() => call(`/api/loans/${l.id}/review`, { approve: false }, "Loan declined", l.id)}
            >
              <p className="text-sm text-zinc-200">
                <span className="font-medium">{l.username}</span> requests a ${l.principal.toLocaleString()} loan
                at {(l.interestRate * 100).toFixed(0)}% interest
                {l.durationDays ? ` for ${l.durationDays} day${l.durationDays === 1 ? "" : "s"}` : ""}
              </p>
              {l.reason && <p className="text-xs text-zinc-500">"{l.reason}"</p>}
              {(l.collateralItems || l.collateralValue) && (
                <p className="mt-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-xs text-zinc-400">
                  <span className="text-zinc-500">Collateral:</span>{" "}
                  {l.collateralItems || "—"}
                  {l.collateralValue ? ` (est. $${l.collateralValue.toLocaleString()})` : ""}
                </p>
              )}
            </Row>
          ))}
        </SectionShell>
      )}

      {canApproveBankRequests && (
        <SectionShell
          icon={Banknote}
          title="Reimbursements owed"
          count={pendingReimbursements.length}
          empty="Nothing owed back to members right now."
        >
          {pendingReimbursements.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-zinc-200">
                  Owe <span className="font-medium">{r.username}</span> ${r.amount.toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">{r.reason}</p>
              </div>
              <button
                onClick={() => call(`/api/reimbursements/${r.id}/pay`, {}, "Marked as paid", r.id)}
                disabled={busyId === r.id}
                className="flex shrink-0 items-center gap-1 rounded-md border border-green-800 bg-green-950/40 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-950/60 disabled:opacity-50"
              >
                {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Mark paid
              </button>
            </div>
          ))}
        </SectionShell>
      )}
    </div>
  );
}

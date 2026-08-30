// components/money/my-loan-card.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface MyLoan {
  id: string;
  status: "PENDING" | "ACTIVE";
  principal: number;
  amountOwed: number;
  interestRate: number;
}

export function MyLoanCard({ loan }: { loan: MyLoan }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loan.status === "PENDING") {
    return (
      <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-300">
        Your loan request for ${loan.principal.toLocaleString()} is waiting on approval.
      </div>
    );
  }

  async function repay(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/${loan.id}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Repayment failed");
      }
      const data = await res.json();
      toast.success(data.fullyRepaid ? "Loan fully repaid!" : "Repayment recorded");
      setAmount("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Repayment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Active loan · {(loan.interestRate * 100).toFixed(0)}% interest, every 5 days</span>
        <span className="font-medium text-red-300">You owe ${loan.amountOwed.toLocaleString()}</span>
      </div>
      <form onSubmit={repay} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Repayment amount"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1 rounded-md bg-gradient-to-b from-red-600 to-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Repay
        </button>
      </form>
    </div>
  );
}

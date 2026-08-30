// components/money/money-forms-tabs.tsx
"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import { BankRequestForm } from "./bank-request-form";
import { LoanRequestForm } from "./loan-request-form";

interface ItemOption {
  id: string;
  name: string;
  currentStock: number;
  suggestedPrice: number;
}

interface PersonalExpenseAllowance {
  totalDonated: number;
  moneyDonated: number;
  itemsDonatedValue: number;
  cap: number;
  alreadyUsed: number;
  remaining: number;
}

export function MoneyFormsTabs({
  items,
  hasActiveLoan = false,
  personalExpenseAllowance,
}: {
  items: ItemOption[];
  hasActiveLoan?: boolean;
  personalExpenseAllowance: PersonalExpenseAllowance;
}) {
  const [tab, setTab] = useState<"give" | "take">("give");

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-lg border border-panel-border bg-panel/50 p-1">
        <button
          onClick={() => setTab("give")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "give" ? "bg-green-950/50 text-green-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" /> Give money
        </button>
        <button
          onClick={() => setTab("take")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "take" ? "bg-red-950/50 text-red-300" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ArrowUpFromLine className="h-4 w-4" /> Take money
        </button>
      </div>

      {tab === "give" ? (
        <div className="mx-auto max-w-xl">
          <TransactionForm items={items} mode="give" />
        </div>
      ) : (
        // Two requests side by side instead of three forms stacked one
        // under another — they're two distinct, equally-weighted paths
        // (ask for money vs. borrow it), so they read better as a pair
        // than as a vertical list with dividers between them.
        <div className="grid gap-6 lg:grid-cols-2">
          <BankRequestForm personalExpenseAllowance={personalExpenseAllowance} />

          {hasActiveLoan ? (
            <div className="flex flex-col justify-center rounded-lg border border-dashed border-panel-border bg-panel/40 p-5 text-center text-sm text-zinc-500">
              You already have a loan open — pay it off before requesting another.
            </div>
          ) : (
            <LoanRequestForm items={items} />
          )}

          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.04]" />
              <span className="text-[11px] uppercase tracking-widest text-zinc-600">or just log an expense</span>
              <div className="h-px flex-1 bg-white/[0.04]" />
            </div>
            <TransactionForm items={items} mode="take" />
          </div>
        </div>
      )}
    </div>
  );
}

// components/money/money-forms-tabs.tsx
"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, HandCoins, ReceiptText, ChevronLeft } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import { BankRequestForm } from "./bank-request-form";
import { LoanRequestForm } from "./loan-request-form";

interface ItemOption {
  id: string;
  name: string;
  currentStock: number;
}

type TakeAction = "withdrawal" | "loan" | "expense";

const TAKE_ACTIONS: { id: TakeAction; label: string; blurb: string; icon: typeof Wallet }[] = [
  { id: "withdrawal", label: "Withdrawal request", blurb: "Ask for money from the family balance, needs approval", icon: Wallet },
  { id: "loan", label: "Loan request", blurb: "Borrow with collateral, 12% interest every 5 days", icon: HandCoins },
  { id: "expense", label: "Log an expense", blurb: "Record fuel, raids, business costs, and more", icon: ReceiptText },
];

export function MoneyFormsTabs({ items, hasActiveLoan = false }: { items: ItemOption[]; hasActiveLoan?: boolean }) {
  const [tab, setTab] = useState<"give" | "take">("give");
  // Which "take" action is expanded — null shows the picker instead of a
  // form, so the tab opens clean instead of dumping three forms at once.
  const [takeAction, setTakeAction] = useState<TakeAction | null>(null);

  return (
    <div>
      <div className="mb-4 flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-1">
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
        <TransactionForm items={items} mode="give" />
      ) : takeAction === null ? (
        <div className="grid gap-2">
          {TAKE_ACTIONS.map(({ id, label, blurb, icon: Icon }) => {
            const disabled = id === "loan" && hasActiveLoan;
            return (
              <button
                key={id}
                onClick={() => !disabled && setTakeAction(id)}
                disabled={disabled}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-zinc-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{label}</p>
                  <p className="text-xs text-zinc-500">
                    {disabled ? "You already have an active loan" : blurb}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setTakeAction(null)}
            className="mb-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          {takeAction === "withdrawal" && <BankRequestForm />}
          {takeAction === "loan" && <LoanRequestForm />}
          {takeAction === "expense" && <TransactionForm items={items} mode="take" />}
        </div>
      )}
    </div>
  );
}


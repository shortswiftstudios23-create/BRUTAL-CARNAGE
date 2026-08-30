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
}

export function MoneyFormsTabs({ items, hasActiveLoan = false }: { items: ItemOption[]; hasActiveLoan?: boolean }) {
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
        <TransactionForm items={items} mode="give" />
      ) : (
        <div className="space-y-6">
          <BankRequestForm />
          {!hasActiveLoan && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.04]" />
                <span className="text-[11px] uppercase tracking-widest text-zinc-600">need it back? try a loan</span>
                <div className="h-px flex-1 bg-white/[0.04]" />
              </div>
              <LoanRequestForm />
            </>
          )}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.04]" />
            <span className="text-[11px] uppercase tracking-widest text-zinc-600">or just log it</span>
            <div className="h-px flex-1 bg-white/[0.04]" />
          </div>
          <TransactionForm items={items} mode="take" />
        </div>
      )}
    </div>
  );
}

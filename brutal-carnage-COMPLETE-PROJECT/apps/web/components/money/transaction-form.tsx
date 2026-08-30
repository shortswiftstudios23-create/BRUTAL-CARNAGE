// components/money/transaction-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { calculateTax, TAXED_TYPES } from "@/lib/tax";
import { backdateOptions } from "@/lib/backdate";

const formSchema = z.object({
  type: z.enum([
    "DONATION", "WITHDRAWAL", "FAMILY_BONUS", "FAMILY_RAID",
    "CARS_FUEL", "RECALLING_CARS", "INVESTMENT", "SOLD_ITEMS", "OTHER_INCOME", "OTHER_EXPENSE",
  ]),
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  note: z.string().max(500).optional(),
  soldItemId: z.string().optional(),
  soldQuantity: z.coerce.number().int().positive().optional(),
  daysAgo: z.coerce.number().int().min(0).max(2).default(0),
  // Only meaningful in "take" mode: did the member cover this out of
  // pocket (so it should be credited to them as a donation, and never
  // touches the family balance) or should it actually be paid out of
  // the family balance (a real expense, no donation credit)?
  fundSource: z.enum(["PERSONAL", "FAMILY_BALANCE"]).default("PERSONAL"),
});

type FormValues = z.infer<typeof formSchema>;

const CATEGORY_LABELS: Record<FormValues["type"], string> = {
  DONATION: "Donation",
  WITHDRAWAL: "Withdrawal",
  FAMILY_BONUS: "Family bonus",
  FAMILY_RAID: "Family raid",
  CARS_FUEL: "Cars fuel",
  RECALLING_CARS: "Recalling cars",
  INVESTMENT: "Investment",
  SOLD_ITEMS: "Sold items",
  OTHER_INCOME: "Other income",
  OTHER_EXPENSE: "Other expense",
};

interface ItemOption {
  id: string;
  name: string;
  currentStock: number;
}

// Which categories count as money coming IN to the family vs going OUT.
// Used to split the form into a clean "Give money" / "Take money" pair
// instead of one dropdown mixing both directions together.
const GIVE_TYPES: FormValues["type"][] = ["DONATION", "FAMILY_BONUS", "SOLD_ITEMS", "OTHER_INCOME"];
// WITHDRAWAL removed on purpose: members no longer pull money out of the
// family balance through this form. Withdrawals from the family's
// balance only happen through the top-level "family business" bank
// request flow (see bank-request-form.tsx).
const TAKE_TYPES: FormValues["type"][] = [
  "FAMILY_RAID",
  "CARS_FUEL",
  "RECALLING_CARS",
  "INVESTMENT",
  "OTHER_EXPENSE",
];

export function TransactionForm({
  items = [],
  mode = "give",
}: {
  items?: ItemOption[];
  /** "give" shows only income categories, "take" shows only expense/record categories. */
  mode?: "give" | "take";
}) {
  const [submitting, setSubmitting] = useState(false);
  const allowedTypes = mode === "give" ? GIVE_TYPES : TAKE_TYPES;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: allowedTypes[0], amount: undefined, note: "", daysAgo: 0, fundSource: "PERSONAL" },
  });

  const watchedType = watch("type");
  const watchedAmount = watch("amount");
  const watchedFundSource = watch("fundSource");

  // In "take" mode, if the member is covering it personally we submit it
  // as a DONATION instead (credited to the family + counted as their
  // donation, never deducted from the family balance). Only an actual
  // "take from family balance" selection uses the real expense type/tax
  // rules for that category.
  const effectiveType: FormValues["type"] =
    mode === "take" && watchedFundSource === "PERSONAL" ? "DONATION" : watchedType;

  const breakdown = useMemo(() => {
    const amount = Number(watchedAmount);
    if (!amount || amount <= 0) return null;
    return calculateTax(amount, effectiveType);
  }, [effectiveType, watchedAmount]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      // Convert the "N days ago" selection into an actual timestamp only
      // when it's not "today" — omitting occurredAt entirely for today
      // keeps the record's real submission time as the source of truth.
      const occurredAt =
        values.daysAgo > 0
          ? new Date(Date.now() - values.daysAgo * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

      // Translate "covered personally" into a real DONATION transaction so
      // it's credited to the family and to the member's donation total,
      // and never touches the family balance. Only an explicit "take from
      // family balance" choice submits the real expense category.
      const isPersonal = mode === "take" && values.fundSource === "PERSONAL";
      const submittedType = isPersonal ? "DONATION" : values.type;
      const note = isPersonal
        ? [values.note?.trim(), `[Spent on: ${CATEGORY_LABELS[values.type]}]`].filter(Boolean).join(" ")
        : values.note;

      const payload = { ...values, type: submittedType, note, occurredAt };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Request failed");

      toast.success("Submitted for approval");
      reset();
    } catch {
      toast.error("Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-panel-border bg-panel/70 p-5">
      <div>
        <h2 className="mb-1 text-sm font-medium text-zinc-200">
          {mode === "give" ? "Give money to the family" : "Record money taken / spent"}
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          {mode === "give"
            ? "Donations, bonuses, and other income credited to the family balance."
            : "Fuel, raids, investments, and other expenses paid out of the family balance."}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Category
        </label>
        <select
          {...register("type")}
          className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        >
          {allowedTypes.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {mode === "take" && (
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
            How are you covering this?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors ${
                watchedFundSource === "PERSONAL"
                  ? "border-red-800 bg-red-950/30 text-red-200"
                  : "border-panel-border bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <input type="radio" value="PERSONAL" {...register("fundSource")} className="sr-only" />
              I'm paying, credit it as my donation
            </label>
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors ${
                watchedFundSource === "FAMILY_BALANCE"
                  ? "border-red-800 bg-red-950/30 text-red-200"
                  : "border-panel-border bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <input type="radio" value="FAMILY_BALANCE" {...register("fundSource")} className="sr-only" />
              Take it from the family balance
            </label>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">
            {watchedFundSource === "PERSONAL"
              ? "You're covering it — this gets logged as a donation from you and never touches the family balance."
              : "This amount will be deducted from the family balance. It will not count as a donation."}
          </p>
        </div>
      )}

      {watchedType === "SOLD_ITEMS" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
              Item sold
            </label>
            <select
              {...register("soldItemId")}
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            >
              <option value="">Select item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.currentStock} in stock)
                </option>
              ))}
            </select>
            {errors.soldItemId && (
              <p className="mt-1 text-xs text-red-500">{errors.soldItemId.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
              Quantity sold
            </label>
            <input
              type="number"
              min={1}
              {...register("soldQuantity")}
              placeholder="e.g. 200"
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>
        </div>
      )}

      {watchedType === "SOLD_ITEMS" && (
        <div className="rounded-md border border-panel-border bg-white/[0.03] p-3 text-xs text-zinc-500">
          Logged as family income from an inventory sale — not counted as your personal donation on the leaderboard. Approving this also removes the sold quantity from stock.
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            type="number"
            step="0.01"
            {...register("amount")}
            placeholder="0.00"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          When did this happen?
        </label>
        <select
          {...register("daysAgo")}
          className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        >
          {backdateOptions().map((opt) => (
            <option key={opt.daysAgo} value={opt.daysAgo}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-600">Forgot to log it on the day? Backdate up to 2 days.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Note <span className="text-zinc-700">(optional)</span>
        </label>
        <textarea
          {...register("note")}
          rows={2}
          className="w-full resize-none rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          placeholder="Add context for reviewers…"
        />
      </div>

      {breakdown && TAXED_TYPES.includes(effectiveType) && (
        <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Original amount</span>
            <span className="text-zinc-200">${breakdown.originalAmount.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-zinc-400">
            <span>Family tax (3%)</span>
            <span className="text-red-400">
              {effectiveType === "DONATION" ? "−" : "+"}${breakdown.taxAmount.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-red-900/40 pt-2 font-medium">
            <span className="text-zinc-300">
              {effectiveType === "DONATION" ? "Credited to family" : "Total you'll pay"}
            </span>
            <span className="text-zinc-100">${breakdown.finalAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {breakdown && !TAXED_TYPES.includes(effectiveType) && (
        <div className="rounded-md border border-panel-border bg-white/[0.03] p-3 text-sm text-zinc-400">
          No tax applies to this category. Full amount: <span className="text-zinc-200">${breakdown.finalAmount.toLocaleString()}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-gradient-to-b from-red-600 to-red-700 py-2.5 text-sm font-medium text-white transition-shadow hover:shadow-glow-crimson disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

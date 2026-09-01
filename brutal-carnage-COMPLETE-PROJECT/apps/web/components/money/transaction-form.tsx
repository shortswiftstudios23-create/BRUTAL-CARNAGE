// components/money/transaction-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
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
  customCategoryId: z.string().optional(),
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

interface CategoryOption {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
  group: string | null;
  icon: string | null;
}

// Which categories count as money coming IN to the family vs going OUT.
// Used to split the form into a clean "Give money" / "Take money" pair
// instead of one dropdown mixing both directions together.
const GIVE_TYPES: FormValues["type"][] = ["DONATION", "FAMILY_BONUS", "SOLD_ITEMS", "OTHER_INCOME"];
const TAKE_TYPES: FormValues["type"][] = [
  "WITHDRAWAL",
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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const allowedTypes = mode === "give" ? GIVE_TYPES : TAKE_TYPES;

  // Custom (admin-managed) categories are only relevant once "Other
  // income/expense" is selected — that's where the fine-grained label
  // (License Plate, House Payment, Business Profit, etc.) gets attached.
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: allowedTypes[0], amount: undefined, note: "", daysAgo: 0 },
  });

  const watchedType = watch("type");
  const watchedAmount = watch("amount");
  const [keepTenPercent, setKeepTenPercent] = useState(false);

  // When donating proceeds from a sale, the member can choose to keep 10%
  // for themselves before the rest goes to the family. The amount typed
  // into the field is the TOTAL they're holding (e.g. what they got from
  // selling items) — donating 90% of that, with the usual 3% family tax
  // applied on top of the donated 90%, not the original total.
  const keptAmount = useMemo(() => {
    if (watchedType !== "DONATION" || !keepTenPercent) return 0;
    const amount = Number(watchedAmount);
    if (!amount || amount <= 0) return 0;
    return Math.round(amount * 0.1 * 100) / 100;
  }, [watchedType, keepTenPercent, watchedAmount]);

  const amountToDonate = useMemo(() => {
    const amount = Number(watchedAmount);
    if (!amount || amount <= 0) return 0;
    return watchedType === "DONATION" && keepTenPercent
      ? Math.round((amount - keptAmount) * 100) / 100
      : amount;
  }, [watchedType, keepTenPercent, watchedAmount, keptAmount]);

  const breakdown = useMemo(() => {
    if (!amountToDonate || amountToDonate <= 0) return null;
    return calculateTax(amountToDonate, watchedType);
  }, [watchedType, amountToDonate]);

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

      // If they're keeping 10%, only the donated portion gets submitted —
      // the kept amount never touches the family ledger at all.
      const payload =
        values.type === "DONATION" && keepTenPercent
          ? {
              ...values,
              amount: amountToDonate,
              occurredAt,
              note: values.note
                ? `${values.note} (kept $${keptAmount.toLocaleString()} for self before donating)`
                : `Kept $${keptAmount.toLocaleString()} for self before donating`,
            }
          : { ...values, occurredAt };

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
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
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        >
          {allowedTypes.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {(watchedType === "OTHER_INCOME" || watchedType === "OTHER_EXPENSE") && (
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
            Specific category <span className="text-zinc-700">(optional)</span>
          </label>
          <select
            {...register("customCategoryId")}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          >
            <option value="">General — no specific category</option>
            {(() => {
              const relevant = categories.filter(
                (c) => c.direction === (watchedType === "OTHER_INCOME" ? "INCOME" : "EXPENSE")
              );
              const byGroup: Record<string, CategoryOption[]> = {};
              for (const c of relevant) {
                const key = c.group || "Other";
                if (!byGroup[key]) byGroup[key] = [];
                byGroup[key].push(c);
              }
              return Object.entries(byGroup).map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}{c.name}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
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
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
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
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>
        </div>
      )}

      {watchedType === "SOLD_ITEMS" && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
          Logged as family income from an inventory sale — not counted as your personal donation on the leaderboard. Approving this also removes the sold quantity from stock.
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          {watchedType === "DONATION" && keepTenPercent ? "Total amount you're holding" : "Amount"}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            type="number"
            step="0.01"
            {...register("amount")}
            placeholder="0.00"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      {watchedType === "DONATION" && (
        <label className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={keepTenPercent}
            onChange={(e) => setKeepTenPercent(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-red-600 focus:ring-red-800"
          />
          Keep 10% for myself before donating the rest
        </label>
      )}

      {watchedType === "DONATION" && keepTenPercent && amountToDonate > 0 && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">
          <div className="flex items-center justify-between">
            <span>You keep (10%)</span>
            <span className="text-zinc-200">${keptAmount.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Amount you're donating (90%)</span>
            <span className="text-zinc-200">${amountToDonate.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          When did this happen?
        </label>
        <select
          {...register("daysAgo")}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
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
          className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          placeholder="Add context for reviewers…"
        />
      </div>

      {breakdown && TAXED_TYPES.includes(watchedType) && (
        <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Original amount</span>
            <span className="text-zinc-200">${breakdown.originalAmount.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-zinc-400">
            <span>Family tax (3%)</span>
            <span className="text-red-400">
              {watchedType === "DONATION" ? "−" : "+"}${breakdown.taxAmount.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-red-900/40 pt-2 font-medium">
            <span className="text-zinc-300">
              {watchedType === "DONATION" ? "Credited to family" : "Total you'll pay"}
            </span>
            <span className="text-zinc-100">${breakdown.finalAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {breakdown && !TAXED_TYPES.includes(watchedType) && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">
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

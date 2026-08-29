// components/money/transaction-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { calculateTax, TAXED_TYPES } from "@/lib/tax";

const formSchema = z.object({
  type: z.enum([
    "DONATION", "WITHDRAWAL", "FAMILY_BONUS", "FAMILY_RAID",
    "CARS_FUEL", "RECALLING_CARS", "INVESTMENT", "SOLD_ITEMS", "OTHER_INCOME", "OTHER_EXPENSE",
  ]),
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  note: z.string().max(500).optional(),
  soldItemId: z.string().optional(),
  soldQuantity: z.coerce.number().int().positive().optional(),
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

export function TransactionForm({ items = [] }: { items?: ItemOption[] }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "DONATION", amount: undefined, note: "" },
  });

  const watchedType = watch("type");
  const watchedAmount = watch("amount");

  const breakdown = useMemo(() => {
    const amount = Number(watchedAmount);
    if (!amount || amount <= 0) return null;
    return calculateTax(amount, watchedType);
  }, [watchedType, watchedAmount]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Category
        </label>
        <select
          {...register("type")}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

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
          Amount
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

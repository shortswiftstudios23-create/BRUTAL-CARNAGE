// components/money/loan-request-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

const formSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  reason: z.string().min(5, "Give a reason (at least 5 characters).").max(500),
  durationDays: z.coerce.number().int().positive("Enter how many days you'll need it").max(365),
  collateralItems: z.string().min(3, "Describe what you're putting up as collateral.").max(1000),
  collateralValue: z.coerce.number().nonnegative("Enter an expected value (0 if none)"),
});

type FormValues = z.infer<typeof formSchema>;

export function LoanRequestForm() {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: undefined, reason: "", durationDays: undefined, collateralItems: "", collateralValue: undefined },
  });

  const watchedAmount = Number(watch("amount"));
  const projectedAfter5Days =
    watchedAmount > 0 ? Math.round(watchedAmount * 1.12 * 100) / 100 : 0;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Request failed");
      }

      toast.success("Loan request submitted for approval");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Request a loan from the family</h2>
        <p className="mb-3 text-xs text-zinc-500">
          12% interest, compounding every 5 days while active. Needs approval, and you can only have one loan open at a time.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Amount</label>
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

      {watchedAmount > 0 && (
        <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm text-zinc-400">
          If unpaid, in 5 days you'd owe <span className="text-zinc-100">${projectedAfter5Days.toLocaleString()}</span> (12% interest, compounds again every 5 days after that).
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
            Days needed
          </label>
          <input
            type="number"
            min={1}
            {...register("durationDays")}
            placeholder="e.g. 10"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
          {errors.durationDays && <p className="mt-1 text-xs text-red-500">{errors.durationDays.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
            Collateral value
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
            <input
              type="number"
              step="0.01"
              {...register("collateralValue")}
              placeholder="0.00"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>
          {errors.collateralValue && <p className="mt-1 text-xs text-red-500">{errors.collateralValue.message}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Collateral items
        </label>
        <textarea
          {...register("collateralItems")}
          rows={2}
          placeholder="What items are you putting up? e.g. 2x Rifle, 1x Sports Car"
          className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        />
        {errors.collateralItems && <p className="mt-1 text-xs text-red-500">{errors.collateralItems.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Reason</label>
        <textarea
          {...register("reason")}
          rows={2}
          placeholder="What is this for?"
          className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        />
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Request loan"}
      </button>
    </form>
  );
}

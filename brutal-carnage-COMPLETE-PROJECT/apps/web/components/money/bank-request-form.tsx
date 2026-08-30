// components/money/bank-request-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  reason: z.string().min(5, "Give a reason (at least 5 characters).").max(500),
  category: z.enum(["GENERAL", "PERSONAL_EXPENSE"]),
});

type FormValues = z.infer<typeof formSchema>;

interface PersonalExpenseAllowance {
  totalDonated: number;
  moneyDonated: number;
  itemsDonatedValue: number;
  cap: number;
  alreadyUsed: number;
  remaining: number;
}

export function BankRequestForm({
  personalExpenseAllowance,
}: {
  personalExpenseAllowance: PersonalExpenseAllowance;
}) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: undefined, reason: "", category: "GENERAL" },
  });

  const category = watch("category");
  const amount = watch("amount");
  const overLimit = useMemo(
    () => category === "PERSONAL_EXPENSE" && Number(amount) > personalExpenseAllowance.remaining,
    [category, amount, personalExpenseAllowance.remaining]
  );

  async function onSubmit(values: FormValues) {
    if (values.category === "PERSONAL_EXPENSE" && values.amount > personalExpenseAllowance.remaining) {
      toast.error(`You only have $${personalExpenseAllowance.remaining.toLocaleString()} of personal-expense allowance left.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Request failed");
      }

      toast.success("Bank request submitted for approval");
      reset({ amount: undefined, reason: "", category: "GENERAL" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col rounded-lg border border-panel-border bg-panel/70 p-5">
      <div>
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Request money from the family</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Needs approval before it pays out. No tax applies to bank requests.
        </p>
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">What's this for?</label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={cn(
              "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors",
              category === "GENERAL"
                ? "border-red-800 bg-red-950/30 text-red-200"
                : "border-panel-border bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
            )}
          >
            <input type="radio" value="GENERAL" {...register("category")} className="sr-only" />
            Family business
          </label>
          <label
            className={cn(
              "cursor-pointer rounded-md border px-3 py-2 text-center text-xs font-medium transition-colors",
              category === "PERSONAL_EXPENSE"
                ? "border-red-800 bg-red-950/30 text-red-200"
                : "border-panel-border bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
            )}
          >
            <input type="radio" value="PERSONAL_EXPENSE" {...register("category")} className="sr-only" />
            Personal expense
          </label>
        </div>
        {category === "PERSONAL_EXPENSE" && (
          <p className="mt-2 text-xs text-zinc-500">
            Capped at 10% of your lifetime donations — money (${personalExpenseAllowance.moneyDonated.toLocaleString()}) plus
            items donated (${personalExpenseAllowance.itemsDonatedValue.toLocaleString()}), totaling $
            {personalExpenseAllowance.totalDonated.toLocaleString()}. You've used $
            {personalExpenseAllowance.alreadyUsed.toLocaleString()}, so you have{" "}
            <span className={overLimit ? "text-red-400" : "text-zinc-300"}>
              ${personalExpenseAllowance.remaining.toLocaleString()} left
            </span>
            .
          </p>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            type="number"
            step="0.01"
            {...register("amount")}
            placeholder="0.00"
            className={cn(
              "w-full rounded-md border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1",
              overLimit
                ? "border-red-600 focus:border-red-600 focus:ring-red-600"
                : "border-panel-border focus:border-red-800 focus:ring-red-800"
            )}
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
        {!errors.amount && overLimit && (
          <p className="mt-1 text-xs text-red-500">That's more than your remaining personal-expense allowance.</p>
        )}
      </div>

      <div className="mb-4 flex-1">
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Reason</label>
        <textarea
          {...register("reason")}
          rows={2}
          placeholder="What is this for?"
          className="w-full resize-none rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        />
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting || overLimit}
        className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Request money"}
      </button>
    </form>
  );
}

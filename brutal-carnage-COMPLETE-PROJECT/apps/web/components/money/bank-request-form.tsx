// components/money/bank-request-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

const formSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  reason: z.string().min(5, "Give a reason (at least 5 characters).").max(500),
});

type FormValues = z.infer<typeof formSchema>;

export function BankRequestForm() {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: undefined, reason: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/bank-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");

      toast.success("Bank request submitted for approval");
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
        <h2 className="mb-1 text-sm font-medium text-zinc-200">Request money from the family</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Needs approval before it pays out. No tax applies to bank requests.
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
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      <div>
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
        disabled={submitting}
        className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Request money"}
      </button>
    </form>
  );
}

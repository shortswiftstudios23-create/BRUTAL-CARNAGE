// components/money/loan-request-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const formSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  reason: z.string().min(5, "Give a reason (at least 5 characters).").max(500),
  collateralNames: z.string().max(300).optional(),
  // Purely informational — not stored as a schema field on the loan
  // itself (the officer sets the real due date on approval), but it's
  // folded into the submitted reason so reviewers see what the member
  // is aiming for.
  preferredRepayDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ItemOption {
  id: string;
  name: string;
  currentStock: number;
  suggestedPrice: number;
}

// 12% interest, compounding every 5 days — matches lib rate used across
// the loan feature (see MyLoanCard / cron/accrue-loan-interest).
const INTEREST_RATE = 0.12;
const COMPOUND_DAYS = 5;

function projectedAmountOwed(principal: number, days: number) {
  const periods = Math.max(0, Math.floor(days / COMPOUND_DAYS));
  return Math.round(principal * Math.pow(1 + INTEREST_RATE, periods) * 100) / 100;
}

export function LoanRequestForm({ items = [] }: { items?: ItemOption[] }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: undefined, reason: "", collateralNames: "", preferredRepayDate: "" },
  });

  const watchedAmount = Number(watch("amount"));
  const watchedCollateral = watch("collateralNames") ?? "";
  const watchedRepayDate = watch("preferredRepayDate");

  const projectedAfter5Days =
    watchedAmount > 0 ? projectedAmountOwed(watchedAmount, COMPOUND_DAYS) : 0;

  // Matches typed-in collateral names (comma separated) against the
  // catalog by name (case-insensitive) so we can show a running total
  // of what the offered collateral is worth, plus flag anything typed
  // that isn't a recognized item (still allowed — freeform names are
  // fine — just not priced).
  const collateralBreakdown = useMemo(() => {
    const names = watchedCollateral
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const byNameLower = new Map(items.map((i) => [i.name.toLowerCase(), i]));

    const rows = names.map((name) => {
      const match = byNameLower.get(name.toLowerCase());
      return { name, price: match?.suggestedPrice ?? null };
    });

    const total = rows.reduce((sum, r) => sum + (r.price ?? 0), 0);
    return { rows, total };
  }, [watchedCollateral, items]);

  // Days from today until the member's chosen repayment date, used to
  // project what they'd owe by then given 12% compounding every 5 days.
  const daysUntilRepay = useMemo(() => {
    if (!watchedRepayDate) return null;
    const target = new Date(watchedRepayDate);
    if (Number.isNaN(target.getTime())) return null;
    const diffMs = target.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  }, [watchedRepayDate]);

  const projectedAtRepayDate =
    watchedAmount > 0 && daysUntilRepay !== null
      ? projectedAmountOwed(watchedAmount, daysUntilRepay)
      : null;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const collateralItems = (values.collateralNames ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((itemName) => ({ itemName, quantity: 1 }));

      const reason = values.preferredRepayDate
        ? `${values.reason} (Hoping to repay by ${values.preferredRepayDate}, projected ~$${projectedAtRepayDate?.toLocaleString()} owed by then.)`
        : values.reason;

      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: values.amount, reason, collateralItems }),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg border border-panel-border bg-panel/70 p-5">
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
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      {watchedAmount > 0 && (
        <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm text-zinc-400">
          If unpaid, in 5 days you'd owe <span className="text-zinc-100">${projectedAfter5Days.toLocaleString()}</span> (12% interest, compounds again every 5 days after that).
        </div>
      )}

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

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Items offered as collateral <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          type="text"
          list="collateral-item-options"
          {...register("collateralNames")}
          placeholder="e.g. Automatic Rod, Dangerous Razor"
          className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        />
        <datalist id="collateral-item-options">
          {items.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-zinc-600">Comma-separated. Shown to the family on your loan record.</p>

        {collateralBreakdown.rows.length > 0 && (
          <div className="mt-2 rounded-md border border-panel-border bg-white/[0.03] p-2.5 text-xs">
            {collateralBreakdown.rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 text-zinc-400">
                <span>{row.name}</span>
                <span className={row.price === null ? "text-zinc-600" : "text-zinc-300"}>
                  {row.price === null ? "not in catalog" : `$${row.price.toLocaleString()}`}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-panel-border pt-1 font-medium">
              <span className="text-zinc-300">Suggested total value</span>
              <span className="text-zinc-100">${collateralBreakdown.total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          When will you repay it? <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          {...register("preferredRepayDate")}
          className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        />
        {projectedAtRepayDate !== null && (
          <p className="mt-1.5 text-xs text-zinc-500">
            By then you'd owe roughly <span className="text-zinc-300">${projectedAtRepayDate.toLocaleString()}</span>{" "}
            ({daysUntilRepay} day{daysUntilRepay === 1 ? "" : "s"} from today, at 12% every 5 days).
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Request loan"}
      </button>
    </form>
  );
}

// components/money/funding-source-select.tsx
"use client";

// Reusable "where did this money come from" question for any admin-issued
// family expense — currently used on event close-out, designed to be
// dropped into car/house/other expense flows later without changes.
// Two questions, only the second appearing once "Personal account" is
// picked, so the common case (family balance) stays a single click.

export type FundingSource = "FAMILY_BALANCE" | "PERSONAL_ACCOUNT";
export type PersonalIntent = "DONATION" | "REIMBURSABLE";

export function FundingSourceSelect({
  source,
  onSourceChange,
  intent,
  onIntentChange,
}: {
  source: FundingSource;
  onSourceChange: (v: FundingSource) => void;
  intent: PersonalIntent | "";
  onIntentChange: (v: PersonalIntent) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
          Where did this money come from?
        </label>
        <div className="flex gap-2">
          {(["FAMILY_BALANCE", "PERSONAL_ACCOUNT"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onSourceChange(opt)}
              className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                source === opt
                  ? "border-red-800 bg-red-950/30 text-red-300"
                  : "border-zinc-800 text-zinc-500 hover:bg-zinc-900"
              }`}
            >
              {opt === "FAMILY_BALANCE" ? "Family balance" : "Personal account"}
            </button>
          ))}
        </div>
      </div>

      {source === "PERSONAL_ACCOUNT" && (
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
            Do you want this back, or is it a donation?
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onIntentChange("DONATION")}
              className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                intent === "DONATION"
                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                  : "border-zinc-800 text-zinc-500 hover:bg-zinc-900"
              }`}
            >
              Count as donation
            </button>
            <button
              type="button"
              onClick={() => onIntentChange("REIMBURSABLE")}
              className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                intent === "REIMBURSABLE"
                  ? "border-amber-800 bg-amber-950/30 text-amber-300"
                  : "border-zinc-800 text-zinc-500 hover:bg-zinc-900"
              }`}
            >
              Pay me back later
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">
            {intent === "REIMBURSABLE"
              ? "The family will owe you this amount — it won't count toward your donation stats."
              : "This credits you as a donor and boosts your leaderboard stats, same as any donation."}
          </p>
        </div>
      )}
    </div>
  );
}

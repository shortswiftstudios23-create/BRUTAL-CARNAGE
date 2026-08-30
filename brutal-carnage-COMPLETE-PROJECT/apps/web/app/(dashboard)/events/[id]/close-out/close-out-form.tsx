// app/(dashboard)/events/[id]/close-out/close-out-form.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Registration {
  userId: string;
  username: string;
}

export function CloseOutForm({
  eventId,
  eventTitle,
  registrations,
}: {
  eventId: string;
  eventTitle: string;
  registrations: Registration[];
}) {
  const router = useRouter();
  const [attended, setAttended] = useState<Set<string>>(new Set(registrations.map((r) => r.userId)));
  const [result, setResult] = useState<"WIN" | "LOSS">("WIN");
  const [bonusAmount, setBonusAmount] = useState("");
  const [mvpUserId, setMvpUserId] = useState("");
  const [mvpBonusAmount, setMvpBonusAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleAttended(userId: string) {
    setAttended((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          attendedUserIds: Array.from(attended),
          bonusAmount: result === "WIN" && bonusAmount ? Number(bonusAmount) : undefined,
          mvpUserId: result === "WIN" && mvpUserId ? mvpUserId : undefined,
          mvpBonusAmount: result === "WIN" && mvpUserId && mvpBonusAmount ? Number(mvpBonusAmount) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed");
      }
      toast.success("Event closed out");
      router.push("/events");
      router.refresh();
    } catch (err) {
      toast.error(typeof err === "object" && err && "message" in err ? String((err as Error).message) : "Couldn't close out the event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
        <h2 className="mb-1 font-display text-base tracking-wide text-zinc-100">{eventTitle}</h2>
        <p className="text-sm text-zinc-500">Mark who showed up, then set the result.</p>
      </div>

      <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
        <h3 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Attendance</h3>
        {registrations.length === 0 ? (
          <p className="text-sm text-zinc-600">No one registered for this event.</p>
        ) : (
          <ul className="space-y-2">
            {registrations.map((r) => (
              <li key={r.userId} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{r.username}</span>
                <div className="flex items-center gap-3">
                  {result === "WIN" && attended.has(r.userId) && (
                    <button
                      type="button"
                      onClick={() => setMvpUserId(mvpUserId === r.userId ? "" : r.userId)}
                      className={cn(
                        "flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                        mvpUserId === r.userId
                          ? "border-amber-700 bg-amber-950/50 text-amber-300"
                          : "border-panel-border text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      <Trophy className="h-3 w-3" />
                      MVP
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={attended.has(r.userId)}
                    onChange={() => toggleAttended(r.userId)}
                    className="h-4 w-4 rounded border-panel-border bg-white/[0.03]"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
        <h3 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Result</h3>
        <div className="mb-4 flex gap-2">
          {(["WIN", "LOSS"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setResult(r)}
              className={cn(
                "flex-1 rounded-md border py-2 text-sm font-medium",
                result === r
                  ? r === "WIN"
                    ? "border-green-800 bg-green-950/40 text-green-300"
                    : "border-red-800 bg-red-950/40 text-red-300"
                  : "border-panel-border text-zinc-500 hover:bg-white/[0.04]"
              )}
            >
              {r === "WIN" ? "Win" : "Loss"}
            </button>
          ))}
        </div>

        {result === "WIN" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                Bonus per attendee ($)
              </label>
              <input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                MVP bonus on top ($)
              </label>
              <input
                type="number"
                value={mvpBonusAmount}
                onChange={(e) => setMvpBonusAmount(e.target.value)}
                placeholder="0"
                disabled={!mvpUserId}
                className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700 disabled:opacity-40"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 py-2.5 text-sm font-medium text-zinc-100 shadow-[0_0_20px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_28px_-2px_rgba(220,38,38,0.7)] disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Close out event
      </button>
    </div>
  );
}

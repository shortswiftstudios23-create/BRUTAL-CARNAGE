// app/(dashboard)/discipline/discipline-client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, FileWarning, Ban, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Strike {
  id: string;
  username: string;
  rank: string;
  issuedBy: string;
  severity: "MINOR" | "MAJOR" | "SEVERE";
  reason: string;
  syncedToDiscord: boolean;
  createdAt: string;
}
interface Report {
  id: string;
  reportedBy: string;
  reportedUser: string;
  reportedRank: string;
  statement: string;
  videoProofUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}
interface Member {
  id: string;
  username: string;
  rank: string;
}

const SEVERITY_STYLE: Record<Strike["severity"], string> = {
  MINOR: "border-amber-800 bg-amber-950/40 text-amber-300",
  MAJOR: "border-orange-800 bg-orange-950/40 text-orange-300",
  SEVERE: "border-red-800 bg-red-950/40 text-red-300",
};

export function DisciplineClient({
  strikes,
  reports,
  blacklisted,
  canManageBlacklist,
  canIssueStrike,
  members,
}: {
  strikes: Strike[];
  reports: Report[];
  blacklisted: { id: string; username: string; blacklistReason: string | null }[];
  canManageBlacklist: boolean;
  canIssueStrike: boolean;
  members: Member[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"strikes" | "reports" | "blacklist">("strikes");
  const [showStrikeForm, setShowStrikeForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reviewReport(id: string, approve: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reports/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      if (!res.ok) throw new Error();
      toast.success(approve ? "Report marked substantiated" : "Report dismissed");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlacklist(userId: string, blacklisted: boolean, reason?: string) {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/members/${userId}/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blacklisted, reason }),
      });
      if (!res.ok) throw new Error();
      toast.success(blacklisted ? "Member blacklisted" : "Member removed from blacklist");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-panel-border bg-panel/70 p-1">
          <TabButton icon={ShieldAlert} label="Strikes" active={tab === "strikes"} onClick={() => setTab("strikes")} />
          <TabButton icon={FileWarning} label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} />
          <TabButton icon={Ban} label="Blacklist" active={tab === "blacklist"} onClick={() => setTab("blacklist")} />
        </div>
        {tab === "strikes" && canIssueStrike && (
          <button
            onClick={() => setShowStrikeForm(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 px-4 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)]"
          >
            <Plus className="h-4 w-4" /> Issue strike
          </button>
        )}
      </div>

      {tab === "strikes" && (
        <div className="rounded-lg border border-panel-border bg-panel/70">
          {strikes.length === 0 ? (
            <p className="p-5 text-sm text-zinc-600">No strikes on record.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {strikes.map((s) => (
                <li key={s.id} className="p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm text-zinc-200">
                      {s.username} <span className="text-zinc-600">· issued by {s.issuedBy}</span>
                    </p>
                    <span className={cn("rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider", SEVERITY_STYLE[s.severity])}>
                      {s.severity}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">{s.reason}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {new Date(s.createdAt).toLocaleDateString()} · {s.syncedToDiscord ? "Synced to Discord" : "Discord DM failed"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="rounded-lg border border-panel-border bg-panel/70">
          {reports.length === 0 ? (
            <p className="p-5 text-sm text-zinc-600">No reports filed.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {reports.map((r) => (
                <li key={r.id} className="p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm text-zinc-200">
                      {r.reportedBy} reported <span className="text-red-400">{r.reportedUser}</span>
                    </p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mb-2 text-sm text-zinc-500">{r.statement}</p>
                  <a
                    href={r.videoProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-3 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                  >
                    View video proof <ExternalLink className="h-3 w-3" />
                  </a>
                  {r.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewReport(r.id, true)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-green-800 px-3 py-1.5 text-xs text-green-300 hover:bg-green-950/30 disabled:opacity-50"
                      >
                        Substantiated
                      </button>
                      <button
                        onClick={() => reviewReport(r.id, false)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "blacklist" && (
        <div className="rounded-lg border border-panel-border bg-panel/70">
          {blacklisted.length === 0 ? (
            <p className="p-5 text-sm text-zinc-600">No one is currently blacklisted.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {blacklisted.map((b) => (
                <li key={b.id} className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-zinc-200">{b.username}</p>
                    {b.blacklistReason && <p className="text-xs text-zinc-500">{b.blacklistReason}</p>}
                  </div>
                  {canManageBlacklist && (
                    <button
                      onClick={() => toggleBlacklist(b.id, false)}
                      disabled={busyId === b.id}
                      className="rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
                    >
                      {busyId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remove from blacklist"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showStrikeForm && (
        <StrikeForm members={members} onClose={() => setShowStrikeForm(false)} />
      )}
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        active ? "bg-red-950/40 text-red-200" : "text-zinc-400 hover:text-zinc-200"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: Report["status"] }) {
  const map = {
    PENDING: "border-amber-800 bg-amber-950/40 text-amber-300",
    APPROVED: "border-red-800 bg-red-950/40 text-red-300",
    REJECTED: "border-panel-border bg-white/[0.03] text-zinc-500",
  };
  const label = { PENDING: "Pending", APPROVED: "Substantiated", REJECTED: "Dismissed" };
  return (
    <span className={cn("rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider", map[status])}>
      {label[status]}
    </span>
  );
}

function StrikeForm({ members, onClose }: { members: Member[]; onClose: () => void }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [severity, setSeverity] = useState<Strike["severity"]>("MINOR");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId || reason.trim().length < 5) {
      toast.error("Pick a member and write a reason (5+ characters)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/strikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, severity, reason }),
      });
      if (!res.ok) throw new Error();
      toast.success("Strike issued and DM'd to the member");
      router.refresh();
      onClose();
    } catch {
      toast.error("Couldn't issue the strike");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-panel-border bg-panel p-6 shadow-2xl">
        <h2 className="mb-4 font-display text-lg tracking-wide text-zinc-100">Issue strike</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Member</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            >
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username} — {m.rank.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Severity</label>
            <div className="flex gap-2">
              {(["MINOR", "MAJOR", "SEVERE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "flex-1 rounded-md border py-2 text-xs uppercase tracking-wider",
                    severity === s ? SEVERITY_STYLE[s] : "border-panel-border text-zinc-500 hover:bg-white/[0.04]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 rounded-md border border-panel-border py-2 text-sm text-zinc-400 hover:bg-white/[0.04]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 py-2 text-sm font-medium text-zinc-100 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Issue strike
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

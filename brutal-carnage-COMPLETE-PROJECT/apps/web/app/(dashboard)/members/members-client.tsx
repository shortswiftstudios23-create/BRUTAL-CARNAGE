// app/(dashboard)/members/members-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Ban, ShieldCheck, StickyNote, Loader2, X } from "lucide-react";
import { RankBadge } from "@/components/layout/rank-badge";
import { Rank } from "@prisma/client";

interface Member {
  id: string;
  username: string;
  discordAvatar: string | null;
  rank: Rank;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  lastActiveAt: string;
  joinedFamilyAt: string;
  isInactive: boolean;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string };
}

const RANK_OPTIONS: Rank[] = [
  "NOOB", "ROOKIE", "CADET", "TURFER", "EVENT_MANAGER",
  "BUSINESS_MANAGER", "UNDER_DEPUTY", "DEPUTY", "BOSS", "BIG_BOSS",
];

export function MembersClient({
  members,
  canManageBlacklist,
  canViewPrivateNotes,
}: {
  members: Member[];
  canManageBlacklist: boolean;
  canViewPrivateNotes: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<Rank | "ALL">("ALL");
  const [showBlacklistedOnly, setShowBlacklistedOnly] = useState(false);
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (query && !m.username.toLowerCase().includes(query.toLowerCase())) return false;
      if (rankFilter !== "ALL" && m.rank !== rankFilter) return false;
      if (showBlacklistedOnly && !m.isBlacklisted) return false;
      return true;
    });
  }, [members, query, rankFilter, showBlacklistedOnly]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value as Rank | "ALL")}
          className="rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
        >
          <option value="ALL">All ranks</option>
          {RANK_OPTIONS.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={showBlacklistedOnly}
            onChange={(e) => setShowBlacklistedOnly(e.target.checked)}
            className="rounded border-panel-border bg-white/[0.03]"
          />
          Blacklisted only
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-panel-border">
        <table className="w-full text-sm">
          <thead className="bg-panel/90 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Last active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((m) => (
              <tr key={m.id} className="bg-panel/50">
                <td className="px-4 py-2 text-zinc-200">{m.username}</td>
                <td className="px-4 py-2"><RankBadge rank={m.rank} /></td>
                <td className="px-4 py-2">
                  {m.isBlacklisted ? (
                    <span className="rounded border border-red-900 bg-red-950/40 px-2 py-0.5 text-xs text-red-300">Blacklisted</span>
                  ) : m.isInactive ? (
                    <span className="rounded border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-300">Inactive</span>
                  ) : (
                    <span className="rounded border border-panel-border bg-white/[0.03] px-2 py-0.5 text-xs text-zinc-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-500">{new Date(m.lastActiveAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {(canManageBlacklist || canViewPrivateNotes) && (
                    <button
                      onClick={() => setActiveMember(m)}
                      className="rounded-md border border-panel-border px-3 py-1 text-xs text-zinc-300 hover:bg-white/[0.04]"
                    >
                      Manage
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">No members match those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeMember && (
        <MemberModal
          member={activeMember}
          canManageBlacklist={canManageBlacklist}
          canViewPrivateNotes={canViewPrivateNotes}
          onClose={() => setActiveMember(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function MemberModal({
  member,
  canManageBlacklist,
  canViewPrivateNotes,
  onClose,
  onChanged,
}: {
  member: Member;
  canManageBlacklist: boolean;
  canViewPrivateNotes: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");

  async function loadNotes() {
    if (!canViewPrivateNotes || notes !== null) return;
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/members/${member.id}/notes`);
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      toast.error("Couldn't load notes");
    } finally {
      setNotesLoading(false);
    }
  }

  // Auto-load as soon as this member's panel opens so the note count/list
  // is visible immediately, instead of being hidden behind an extra click.
  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  async function toggleBlacklist(blacklisted: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${member.id}/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blacklisted, reason: blacklisted ? blacklistReason : undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success(blacklisted ? "Member blacklisted" : "Removed from blacklist");
      onChanged();
      onClose();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (newNote.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${member.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      if (!res.ok) throw new Error();
      setNewNote("");
      setNotes(null);
      await loadNotes();
      toast.success("Note added");
    } catch {
      toast.error("Couldn't add note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-panel-border bg-panel p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-100">{member.username}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {canManageBlacklist && (
          <div className="mb-5 space-y-2 border-b border-panel-border pb-5">
            {member.isBlacklisted ? (
              <>
                <p className="text-xs text-zinc-500">Blacklisted: {member.blacklistReason || "no reason given"}</p>
                <button
                  onClick={() => toggleBlacklist(false)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-green-800 bg-green-950/40 py-2 text-sm text-green-300 hover:bg-green-950/60 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Remove from blacklist
                </button>
              </>
            ) : (
              <>
                <input
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="Reason for blacklisting…"
                  className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
                />
                <button
                  onClick={() => toggleBlacklist(true)}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-red-900 bg-red-950/40 py-2 text-sm text-red-300 hover:bg-red-950/60 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Blacklist member
                </button>
              </>
            )}
          </div>
        )}

        {canViewPrivateNotes && (
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
            <button
              onClick={loadNotes}
              className="mb-3 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400"
            >
              <StickyNote className="h-4 w-4" />
              Private notes
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-bold text-amber-300">
                {notes?.length ?? "…"}
              </span>
            </button>

            {notesLoading && <p className="text-xs text-zinc-600">Loading…</p>}

            <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
              {notes?.map((n) => (
                <div key={n.id} className="rounded-md border border-panel-border bg-white/[0.03] p-2 text-xs">
                  <p className="text-zinc-300">{n.content}</p>
                  <p className="mt-1 text-zinc-600">— {n.author.username}, {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {notes?.length === 0 && <p className="text-xs text-zinc-600">No notes yet.</p>}
            </div>

            <div className="flex gap-2">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a private note…"
                className="flex-1 rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
              <button
                onClick={addNote}
                disabled={busy}
                className="rounded-md border border-panel-border px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

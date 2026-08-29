// app/(dashboard)/announcements/announcements-client.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Trash2, Plus, Loader2, Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  author: string;
}

export function AnnouncementsClient({
  announcements,
  canManage,
}: {
  announcements: Announcement[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handlePost() {
    if (title.trim().length < 3 || content.trim().length === 0) {
      toast.error("Add a title (3+ chars) and some content.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, pinned }),
      });
      if (!res.ok) throw new Error();
      toast.success("Announcement posted to the whole family.");
      setShowComposer(false);
      setTitle("");
      setContent("");
      setPinned(false);
      router.refresh();
    } catch {
      toast.error("Failed to post announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(id: string, next: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Failed to update.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement permanently?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Announcement removed.");
      router.refresh();
    } catch {
      toast.error("Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {canManage && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowComposer((s) => !s)}
            className="flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            <Plus className="h-4 w-4" />
            New announcement
          </button>
        </div>
      )}

      {showComposer && (
        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mb-3 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What does the family need to know?"
            rows={4}
            className="mb-3 w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to top
            </label>
            <button
              onClick={handlePost}
              disabled={submitting}
              className="flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Post to family
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-10 text-center text-sm text-zinc-600">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            No announcements yet.
          </div>
        )}

        {announcements.map((a) => (
          <div
            key={a.id}
            className={`rounded-lg border p-5 ${
              a.pinned ? "border-red-800/60 bg-red-950/10" : "border-zinc-800 bg-zinc-950/60"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                {a.pinned && <Pin className="h-3.5 w-3.5 text-red-400" />}
                <h3 className="font-medium text-zinc-100">{a.title}</h3>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => togglePin(a.id, !a.pinned)}
                    disabled={busyId === a.id}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                    title={a.pinned ? "Unpin" : "Pin"}
                  >
                    {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    disabled={busyId === a.id}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-red-950 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-400">{a.content}</p>
            <p className="mt-3 text-xs text-zinc-600">
              {a.author} ·{" "}
              {new Date(a.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// app/(dashboard)/evidence/evidence-client.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderLock, Video, ImageIcon, ExternalLink, Link2, Plus, Loader2, X } from "lucide-react";

interface EvidenceFile {
  id: string;
  url: string;
  type: "video" | "image";
  title: string | null;
  description: string | null;
  relatedReportId: string | null;
  uploadedBy: string;
  createdAt: string;
}

export function EvidenceClient({ files }: { files: EvidenceFile[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "video" | "image" | "report">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [url, setUrl] = useState("");
  const [type, setType] = useState<"video" | "image">("image");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const filtered = useMemo(() => {
    if (filter === "all") return files;
    if (filter === "report") return files.filter((f) => f.relatedReportId);
    return files.filter((f) => f.type === filter);
  }, [files, filter]);

  const TABS: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All (${files.length})` },
    { key: "video", label: `Video (${files.filter((f) => f.type === "video").length})` },
    { key: "image", label: `Image (${files.filter((f) => f.type === "image").length})` },
    { key: "report", label: `Report proof (${files.filter((f) => f.relatedReportId).length})` },
  ];

  function resetForm() {
    setUrl("");
    setType("image");
    setTitle("");
    setDescription("");
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Paste a link first (e.g. a Google Drive share link).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          type,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ? "Check the link and try again." : "Couldn't file that evidence.");
      }
      toast.success("Evidence filed.");
      resetForm();
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't file that evidence.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key ? "bg-red-950/40 text-red-200" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFormOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-gradient-to-b from-red-600 to-red-700 px-3 py-1.5 text-xs font-medium text-white transition-shadow hover:shadow-glow-crimson"
        >
          {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {formOpen ? "Cancel" : "Add link"}
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={submitLink}
          className="mb-6 space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-5"
        >
          <div>
            <h2 className="mb-1 text-sm font-medium text-zinc-200">File a Drive link (or any URL)</h2>
            <p className="text-xs text-zinc-500">
              Paste a Google Drive / video / image link, say what it is, and it lands here for everyone with access to the locker.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Link</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://drive.google.com/..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "video" | "image")}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              >
                <option value="image">Image / photo</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
                Title <span className="text-zinc-700">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. Warehouse raid footage"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500">
              Details <span className="text-zinc-700">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What does this show? Who/what/when?"
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gradient-to-b from-red-600 to-red-700 py-2.5 text-sm font-medium text-white transition-shadow hover:shadow-glow-crimson disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Filing…
              </span>
            ) : (
              "File evidence"
            )}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-10 text-center text-sm text-zinc-600">
          <FolderLock className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          Nothing filed here yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-red-900"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                  {f.type === "video" ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="text-xs uppercase tracking-wide">{f.type}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-600 group-hover:text-red-400" />
              </div>

              {f.type === "image" ? (
                <div
                  className="mb-3 h-32 rounded-md bg-cover bg-center bg-zinc-900"
                  style={{ backgroundImage: `url(${f.url})` }}
                />
              ) : (
                <div className="mb-3 flex h-32 items-center justify-center rounded-md bg-zinc-900">
                  <Video className="h-8 w-8 text-zinc-700" />
                </div>
              )}

              {f.title && <p className="mb-1 truncate text-sm font-medium text-zinc-200">{f.title}</p>}
              {f.description && (
                <p className="mb-2 line-clamp-2 text-xs text-zinc-500">{f.description}</p>
              )}

              <p className="truncate text-xs text-zinc-500">{f.uploadedBy}</p>
              <p className="text-xs text-zinc-600">
                {new Date(f.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {f.relatedReportId && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-500">
                  <Link2 className="h-3 w-3" />
                  Linked to a report
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

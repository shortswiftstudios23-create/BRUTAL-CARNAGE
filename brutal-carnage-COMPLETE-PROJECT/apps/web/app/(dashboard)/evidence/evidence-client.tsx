// app/(dashboard)/evidence/evidence-client.tsx
"use client";

import { useState, useMemo } from "react";
import { FolderLock, Video, ImageIcon, ExternalLink, Link2 } from "lucide-react";

interface EvidenceFile {
  id: string;
  url: string;
  type: "video" | "image";
  relatedReportId: string | null;
  uploadedBy: string;
  createdAt: string;
}

export function EvidenceClient({ files }: { files: EvidenceFile[] }) {
  const [filter, setFilter] = useState<"all" | "video" | "image" | "report">("all");

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

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 border-b border-zinc-800 pb-3">
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

"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-900 bg-red-950/50 text-red-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-display text-xl tracking-wide text-zinc-100">Something broke</p>
        <p className="mt-1 text-sm text-zinc-500">
          That page hit an error loading its data. Try again, and if it keeps happening let an admin know.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-200 hover:bg-red-950/70"
      >
        Try again
      </button>
    </div>
  );
}

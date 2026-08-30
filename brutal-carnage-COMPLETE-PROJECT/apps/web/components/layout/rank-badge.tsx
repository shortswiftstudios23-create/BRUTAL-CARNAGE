// components/layout/rank-badge.tsx
// Every rank gets a distinct color + short label so status is scannable
// at a glance across tables, the sidebar, and member cards. Colors ramp
// from steel (junior) to crimson/gold (senior) — seniority is legible
// by color temperature alone, not just text.

import { Rank } from "@prisma/client";
import { cn } from "@/lib/utils";

const RANK_CONFIG: Record<Rank, { label: string; className: string }> = {
  NOOB: { label: "Noob", className: "bg-zinc-800 text-zinc-400 border-zinc-700" },
  ROOKIE: { label: "Rookie", className: "bg-zinc-800 text-zinc-300 border-zinc-700" },
  CADET: { label: "Cadet", className: "bg-slate-800 text-slate-300 border-slate-600" },
  TURFER: { label: "Turfer", className: "bg-blue-950 text-blue-300 border-blue-800" },
  EVENT_MANAGER: { label: "Event Manager", className: "bg-indigo-950 text-indigo-300 border-indigo-800" },
  BUSINESS_MANAGER: { label: "Business Manager", className: "bg-amber-950 text-amber-300 border-amber-800" },
  UNDER_DEPUTY: { label: "Under Deputy", className: "bg-orange-950 text-orange-300 border-orange-800" },
  DEPUTY: { label: "Deputy", className: "bg-red-950 text-red-300 border-red-800" },
  BOSS: { label: "Boss", className: "bg-red-900 text-red-200 border-red-700" },
  BIG_BOSS: { label: "Big Boss", className: "bg-gradient-to-r from-red-900 to-red-700 text-red-100 border-red-500" },
};

export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  const config = RANK_CONFIG[rank];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium tracking-wide",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

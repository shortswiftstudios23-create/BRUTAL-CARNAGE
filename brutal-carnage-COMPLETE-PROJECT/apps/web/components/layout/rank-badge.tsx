// components/layout/rank-badge.tsx
// Every rank gets a distinct color + short label so status is scannable
// at a glance across tables, the sidebar, and member cards. Colors ramp
// from steel (junior) to crimson/gold (senior) — seniority is legible
// by color temperature alone, not just text.

import { Rank } from "@prisma/client";
import { cn } from "@/lib/utils";

const RANK_CONFIG: Record<Rank, { label: string; className: string; dot: string; glow?: boolean }> = {
  NOOB: { label: "Noob", className: "bg-white/[0.05] text-zinc-400 border-panel-border", dot: "bg-zinc-500" },
  ROOKIE: { label: "Rookie", className: "bg-white/[0.05] text-zinc-300 border-panel-border", dot: "bg-zinc-400" },
  CADET: { label: "Cadet", className: "bg-slate-800/60 text-slate-300 border-slate-600", dot: "bg-slate-400" },
  TURFER: { label: "Turfer", className: "bg-blue-950/60 text-blue-300 border-blue-800", dot: "bg-blue-400" },
  EVENT_MANAGER: {
    label: "Event Manager",
    className: "bg-indigo-950/60 text-indigo-300 border-indigo-800",
    dot: "bg-indigo-400",
  },
  BUSINESS_MANAGER: {
    label: "Business Manager",
    className: "bg-amber-950/60 text-amber-300 border-amber-800",
    dot: "bg-amber-400",
  },
  UNDER_DEPUTY: {
    label: "Under Deputy",
    className: "bg-orange-950/60 text-orange-300 border-orange-800",
    dot: "bg-orange-400",
  },
  DEPUTY: { label: "Deputy", className: "bg-red-950/60 text-red-300 border-red-800", dot: "bg-red-400" },
  BOSS: { label: "Boss", className: "bg-red-900/60 text-red-200 border-red-700", dot: "bg-red-400", glow: true },
  BIG_BOSS: {
    label: "Big Boss",
    className: "bg-gradient-to-r from-amber-950/70 to-red-950/70 text-gold-light border-gold-dark/70",
    dot: "bg-gold",
    glow: true,
  },
};

export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  const config = RANK_CONFIG[rank];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide backdrop-blur-sm",
        config.className,
        config.glow && "shadow-glow-crimson",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

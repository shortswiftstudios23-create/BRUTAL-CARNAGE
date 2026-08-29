// components/shared/stat-card.tsx
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "neutral",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number; // positive or negative percent
  trendLabel?: string;
  accent?: "neutral" | "danger" | "success";
}) {
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-panel-border bg-panel p-5 shadow-panel transition-transform hover:-translate-y-0.5">
      {/* Accent bar along the top edge instead of a colored border — reads
          as a deliberate design detail rather than "card with a border". */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] opacity-70",
          accent === "danger" && "bg-gradient-to-r from-red-600 to-transparent",
          accent === "success" && "bg-gradient-to-r from-emerald-500 to-transparent",
          accent === "neutral" && "bg-gradient-to-r from-zinc-500 to-transparent"
        )}
      />

      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest2 text-zinc-500">
          {label}
        </span>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border transition-transform group-hover:scale-105",
            accent === "danger" && "border-red-900/60 bg-red-950/40 text-red-400",
            accent === "success" && "border-emerald-900/60 bg-emerald-950/40 text-emerald-400",
            accent === "neutral" && "border-panel-border bg-white/[0.03] text-zinc-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-4 font-display text-4xl tracking-wide text-zinc-50">{value}</p>

      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={isPositive ? "text-emerald-500" : "text-red-500"}>
            {Math.abs(trend)}%
          </span>
          <span className="text-zinc-600">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

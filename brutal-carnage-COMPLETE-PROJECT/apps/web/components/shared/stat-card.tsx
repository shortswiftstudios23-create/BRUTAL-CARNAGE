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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border",
            accent === "danger" && "border-red-900 bg-red-950/50 text-red-400",
            accent === "success" && "border-green-900 bg-green-950/50 text-green-400",
            accent === "neutral" && "border-zinc-800 bg-zinc-900 text-zinc-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-4 font-display text-3xl tracking-wide text-zinc-100">{value}</p>

      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {isPositive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={isPositive ? "text-green-500" : "text-red-500"}>
            {Math.abs(trend)}%
          </span>
          <span className="text-zinc-600">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

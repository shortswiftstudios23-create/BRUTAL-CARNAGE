// components/performance/badge-pill.tsx
import { Award, Flame, ShieldCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGE_ICONS: Record<string, React.ElementType> = {
  "Top Donor": Award,
  "Event Beast": Flame,
  Reliable: ShieldCheck,
  "Most Improved": TrendingUp,
};

const BADGE_COLORS: Record<string, string> = {
  "Top Donor": "border-amber-800 bg-amber-950/40 text-amber-300",
  "Event Beast": "border-red-800 bg-red-950/40 text-red-300",
  Reliable: "border-blue-800 bg-blue-950/40 text-blue-300",
  "Most Improved": "border-green-800 bg-green-950/40 text-green-300",
};

export function BadgePill({ name }: { name: string }) {
  const Icon = BADGE_ICONS[name] ?? Award;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        BADGE_COLORS[name] ?? "border-zinc-700 bg-zinc-900 text-zinc-300"
      )}
    >
      <Icon className="h-3 w-3" />
      {name}
    </span>
  );
}

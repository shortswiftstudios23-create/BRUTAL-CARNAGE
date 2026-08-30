// bot/src/lib/rankLabels.ts
// Web-side copy lives in apps/web/lib/discord.ts (formatRankLabel) — MUST
// stay in sync with that. Converts between the Rank enum and the
// human-readable labels used in the fixed promotion-request template
// (e.g. "UNDER_DEPUTY" <-> "Under Deputy").

import { Rank } from "@prisma/client";

const ALL_RANKS: Rank[] = [
  "NOOB", "ROOKIE", "CADET", "TURFER", "EVENT_MANAGER",
  "BUSINESS_MANAGER", "UNDER_DEPUTY", "DEPUTY", "BOSS", "BIG_BOSS",
];

export function formatRankLabel(rank: Rank): string {
  return rank
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

// Short forms used for the "Rank | Name | ID" server nickname when the
// full label + name + id would blow past Discord's 32-char nickname
// limit. Kept short enough that even long names usually still fit.
const SHORT_LABELS: Record<Rank, string> = {
  NOOB: "Noob",
  ROOKIE: "Rookie",
  CADET: "Cadet",
  TURFER: "Turfer",
  EVENT_MANAGER: "EM",
  BUSINESS_MANAGER: "BM",
  UNDER_DEPUTY: "UD",
  DEPUTY: "Dep",
  BOSS: "Boss",
  BIG_BOSS: "BB",
};

export function shortRankLabel(rank: Rank): string {
  return SHORT_LABELS[rank];
}

const LABEL_TO_RANK: Record<string, Rank> = Object.fromEntries(
  ALL_RANKS.map((rank) => [formatRankLabel(rank).toLowerCase(), rank])
);

// Accepts "Under Deputy", "UNDER_DEPUTY", "under deputy", etc.
export function parseRankLabel(input: string): Rank | null {
  const normalized = input.trim().toLowerCase().replace(/_/g, " ");
  return LABEL_TO_RANK[normalized] ?? null;
}

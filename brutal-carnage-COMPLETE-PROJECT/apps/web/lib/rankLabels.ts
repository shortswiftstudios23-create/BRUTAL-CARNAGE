// apps/web/lib/rankLabels.ts
// Bot-side copy lives in bot/src/lib/rankLabels.ts — MUST stay in sync
// with that. Converts between the Rank enum and the human-readable
// labels used in Discord messages (e.g. "UNDER_DEPUTY" -> "Under Deputy").

import { Rank } from "@prisma/client";

export function formatRankLabel(rank: Rank): string {
  return rank
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

// Mirrors bot/src/lib/rankLabels.ts — MUST stay in sync with that.
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

// Builds the "Rank | Name | ID" server nickname, falling back to the
// short rank form (and finally trimming the name) so it always fits
// inside Discord's 32-character nickname limit.
export function buildServerNickname(rank: Rank, name: string, gameId: string): string {
  const NICK_LIMIT = 32;
  const full = `${formatRankLabel(rank)} | ${name} | ${gameId}`;
  if (full.length <= NICK_LIMIT) return full;

  const short = `${shortRankLabel(rank)} | ${name} | ${gameId}`;
  if (short.length <= NICK_LIMIT) return short;

  const fixedLen = short.length - name.length;
  const availableForName = Math.max(1, NICK_LIMIT - fixedLen);
  const trimmedName = name.slice(0, availableForName).trim();
  return `${shortRankLabel(rank)} | ${trimmedName} | ${gameId}`.slice(0, NICK_LIMIT);
}

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

// bot/src/lib/nickname.ts
// Web-side copy lives in apps/web/lib/rankLabels.ts (buildServerNickname)
// — MUST stay in sync with that. Builds the "Rank | Name | ID" server
// nickname, falling back to the short rank form (and finally trimming
// the name) so it always fits inside Discord's 32-character nickname
// limit.

import { Rank } from "@prisma/client";
import { formatRankLabel, shortRankLabel } from "./rankLabels";

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

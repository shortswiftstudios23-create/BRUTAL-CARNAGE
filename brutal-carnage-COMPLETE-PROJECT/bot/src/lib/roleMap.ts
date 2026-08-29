// bot/src/lib/roleMap.ts
// The single source of truth mapping Discord role IDs to website Rank enum
// values. Fill in the actual role IDs from your server (right-click a role
// in Discord with Developer Mode on -> Copy Role ID).
//
// IMPORTANT: a member should hold exactly ONE of these rank roles at a time.
// If a member somehow has multiple, the bot picks the HIGHEST rank found.

import { Rank } from "@prisma/client";

export const ROLE_TO_RANK: Record<string, Rank> = {
  "1542487055844515847": "NOOB",
  "1542487055844515848": "ROOKIE",
  "1542487055844515849": "CADET",
  "1542487055886716968": "TURFER",
  "1542487055886716970": "EVENT_MANAGER",
  "1542487055886716969": "BUSINESS_MANAGER",
  "1542487055886716971": "UNDER_DEPUTY",
  "1542487055886716972": "DEPUTY",
  "1542487055886716973": "BOSS",
  "1542487055886716974": "BIG_BOSS",
};

export const RANK_TO_ROLE: Record<Rank, string> = Object.fromEntries(
  Object.entries(ROLE_TO_RANK).map(([roleId, rank]) => [rank, roleId])
) as Record<Rank, string>;

const RANK_SENIORITY: Rank[] = [
  "NOOB", "ROOKIE", "CADET", "TURFER", "EVENT_MANAGER",
  "BUSINESS_MANAGER", "UNDER_DEPUTY", "DEPUTY", "BOSS", "BIG_BOSS",
];

// Given a Discord GuildMember's current role IDs, return the highest
// matching Rank, or null if they hold none of the mapped roles.
export function resolveHighestRank(memberRoleIds: string[]): Rank | null {
  const matched = memberRoleIds
    .map((id) => ROLE_TO_RANK[id])
    .filter((r): r is Rank => Boolean(r));

  if (matched.length === 0) return null;

  return matched.sort(
    (a, b) => RANK_SENIORITY.indexOf(b) - RANK_SENIORITY.indexOf(a)
  )[0];
}

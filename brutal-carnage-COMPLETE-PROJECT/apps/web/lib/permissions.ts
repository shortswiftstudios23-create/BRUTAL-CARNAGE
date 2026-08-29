// lib/permissions.ts
// Central rank hierarchy + permission checks. Every route/component that
// needs a rank gate imports from here — never hardcode rank comparisons
// inline, so the hierarchy only has to change in one place.

import { Rank } from "@prisma/client";

// Order matters — index = seniority level.
export const RANK_ORDER: Rank[] = [
  "NOOB",
  "ROOKIE",
  "CADET",
  "TURFER",
  "EVENT_MANAGER",
  "BUSINESS_MANAGER",
  "UNDER_DEPUTY",
  "DEPUTY",
  "BOSS",
  "BIG_BOSS",
];

export function rankLevel(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

export function isAtLeast(userRank: Rank, requiredRank: Rank): boolean {
  return rankLevel(userRank) >= rankLevel(requiredRank);
}

// Named permission gates — express intent, not raw rank comparisons.
// If the threshold for "who can see private notes" ever changes, this
// is the only line that needs to move.
export const PERMISSIONS = {
  // Deputy+ only
  canViewPrivateNotes: (r: Rank) => isAtLeast(r, "DEPUTY"),
  canViewReports: (r: Rank) => isAtLeast(r, "DEPUTY"),
  canIssueStrike: (r: Rank) => isAtLeast(r, "UNDER_DEPUTY"),
  canManageBlacklist: (r: Rank) => isAtLeast(r, "DEPUTY"),

  // Business Manager+ (inventory/money oversight)
  canApproveItemActions: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApprovePendingItems: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApproveTransactions: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApproveBankRequests: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canViewDetailedLogs: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),

  // Event Manager+ (event creation)
  canCreateEvent: (r: Rank) => isAtLeast(r, "EVENT_MANAGER"),
  canMarkEventResult: (r: Rank) => isAtLeast(r, "EVENT_MANAGER"),

  // Under Deputy+ (promotion pipeline)
  canReviewPromotions: (r: Rank) => isAtLeast(r, "UNDER_DEPUTY"),
  canSubmitPromotionRequest: (r: Rank) => isAtLeast(r, "CADET"), // must be past Rookie to be promotable via request

  // Boss+ (top-level admin)
  canManageAnnouncements: (r: Rank) => isAtLeast(r, "BOSS"),
  canEditFamilyBalanceDirectly: (r: Rank) => isAtLeast(r, "BOSS"),
  canManageAdminWidgets: (r: Rank) => isAtLeast(r, "BOSS"),

  // Admin panel — the consolidated "everything awaiting a decision"
  // screen. Gated to whoever can approve at least one thing (Business
  // Manager and up: admins, under deputy, deputy, boss, big boss).
  canAccessAdminPanel: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function can(rank: Rank, permission: PermissionKey): boolean {
  return PERMISSIONS[permission](rank);
}

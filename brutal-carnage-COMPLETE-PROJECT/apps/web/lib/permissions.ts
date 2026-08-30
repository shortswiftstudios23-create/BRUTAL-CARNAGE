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

  // Deputy/Boss/Big Boss can list family-owned inventory for sale in the
  // marketplace (separate from members listing their own personal items).
  canListFamilyStockForSale: (r: Rank) => isAtLeast(r, "DEPUTY"),

  // Business Manager+ (inventory/money oversight)
  canApproveItemActions: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApprovePendingItems: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApproveTransactions: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApproveBankRequests: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
  canApproveLoans: (r: Rank) => isAtLeast(r, "BUSINESS_MANAGER"),
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

  // Deputy+ can hand-create a member's ID/password instead of waiting
  // for the Discord bot to auto-provision one on join. Kept separate
  // from canManageBlacklist etc. even though the threshold matches
  // today, so this can be tuned independently later.
  canCreateMemberManually: (r: Rank) => isAtLeast(r, "DEPUTY"),

  // Deputy+ view of every item ever added historically (not just
  // current stock) with the ability to correct name/price.
  canViewTotalItemsAdded: (r: Rank) => isAtLeast(r, "DEPUTY"),
  canEditItemCatalog: (r: Rank) => isAtLeast(r, "DEPUTY"),

  // Boss+ per-member performance drill-down: donation/withdrawal
  // timeline and event history for any single member, not just your own.
  canViewMemberPerformanceDetail: (r: Rank) => isAtLeast(r, "BOSS"),

  // Event Manager+ already mark results (canMarkEventResult above); this
  // is the narrower "see who registered vs who actually showed up"
  // read-only view, and the extended 3-day post-start visibility window
  // on the events list. Same threshold today, kept as its own key so it
  // can be tuned independently of result-marking later.
  canViewEventAttendance: (r: Rank) => isAtLeast(r, "EVENT_MANAGER"),
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function can(rank: Rank, permission: PermissionKey): boolean {
  return PERMISSIONS[permission](rank);
}

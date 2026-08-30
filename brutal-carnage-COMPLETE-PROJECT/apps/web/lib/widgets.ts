// lib/widgets.ts
// Single source of truth for what a dashboard "widget" is. Adding a new
// widget to the dashboard means: build the component, register it here,
// done — the picker, the save route, and the renderer all read from this.

export interface WidgetDef {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  // Larger widgets (chart, activity feed) span the full grid; small ones
  // (stat cards) sit in the 4-up row. Purely a layout hint for the grid.
  size: "sm" | "lg";
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "balance", label: "Family balance", description: "Current family bank balance.", defaultEnabled: true, size: "sm" },
  { id: "inventory_count", label: "Inventory items", description: "Total distinct items in stock.", defaultEnabled: true, size: "sm" },
  { id: "member_count", label: "Active members", description: "Members not blacklisted.", defaultEnabled: true, size: "sm" },
  { id: "upcoming_event_count", label: "Upcoming events", description: "Scheduled events count.", defaultEnabled: true, size: "sm" },
  { id: "balance_chart", label: "Balance trend", description: "30-day family balance chart.", defaultEnabled: true, size: "lg" },
  { id: "upcoming_events", label: "Upcoming events list", description: "Next 3 scheduled events.", defaultEnabled: true, size: "lg" },
  { id: "recent_activity", label: "Recent activity", description: "Latest audit log entries.", defaultEnabled: true, size: "lg" },
  { id: "pending_approvals", label: "Pending approvals", description: "Items/transactions/bank requests awaiting your review.", defaultEnabled: true, size: "lg" },
  { id: "leaderboard_preview", label: "Top contributors", description: "Top 5 on the contribution leaderboard.", defaultEnabled: false, size: "lg" },
  { id: "announcements_preview", label: "Pinned announcements", description: "Latest pinned family announcements.", defaultEnabled: false, size: "lg" },
];

export interface WidgetPref {
  id: string;
  enabled: boolean;
  order: number;
}

export function defaultWidgetPrefs(): WidgetPref[] {
  return WIDGET_REGISTRY.map((w, i) => ({ id: w.id, enabled: w.defaultEnabled, order: i }));
}

// Merges a stored (possibly stale/partial — a new widget shipped since
// the user last saved, or an old id was removed) preference list against
// the current registry so the UI never crashes on drift.
export function reconcileWidgetPrefs(stored: WidgetPref[] | null | undefined): WidgetPref[] {
  if (!stored || stored.length === 0) return defaultWidgetPrefs();

  const byId = new Map(stored.map((w) => [w.id, w]));
  const known = WIDGET_REGISTRY.map((def, i) => {
    const existing = byId.get(def.id);
    return existing ?? { id: def.id, enabled: def.defaultEnabled, order: i };
  });

  return known.sort((a, b) => a.order - b.order);
}

export function widgetDef(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

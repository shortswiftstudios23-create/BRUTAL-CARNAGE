// components/layout/topbar.tsx
"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Topbar({ pageTitle, notificationCount }: { pageTitle: string; notificationCount: number }) {
  const [query, setQuery] = useState("");

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-panel-border bg-panel/90 px-6 backdrop-blur-md">
      {/* Explicit stacking context: without this, the header's own
          backdrop-blur creates a stacking context that paints in normal
          DOM order — meaning anything overflowing from it (the
          notification dropdown) renders BEHIND whatever page content
          comes after it in the markup, even though the dropdown itself
          is z-50. Raising the header itself above the page body fixes
          every popover anchored to it, not just this one. */}
      <h1 className="font-display text-xl tracking-wide text-zinc-100">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, items, events…"
            className="w-72 rounded-lg border border-panel-border bg-black/20 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-crimson-dark focus:outline-none focus:ring-1 focus:ring-crimson-dark"
          />
        </div>

        <div className="h-6 w-px bg-panel-border" />

        <ThemeToggle />
        <NotificationBell initialUnreadCount={notificationCount} />
      </div>
    </header>
  );
}

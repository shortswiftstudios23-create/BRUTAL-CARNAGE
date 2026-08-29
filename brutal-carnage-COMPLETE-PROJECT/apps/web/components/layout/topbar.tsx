// components/layout/topbar.tsx
"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Topbar({ pageTitle, notificationCount }: { pageTitle: string; notificationCount: number }) {
  const [query, setQuery] = useState("");

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-panel-border bg-panel/90 px-6 backdrop-blur-md">
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

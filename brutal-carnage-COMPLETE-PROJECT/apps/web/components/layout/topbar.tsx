// components/layout/topbar.tsx
"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Topbar({ pageTitle, notificationCount }: { pageTitle: string; notificationCount: number }) {
  const [query, setQuery] = useState("");

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-[#0A0A0B]/95 px-6 backdrop-blur">
      <h1 className="font-display text-lg tracking-wide text-zinc-100">{pageTitle}</h1>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, items, events…"
            className="w-72 rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>

        <ThemeToggle />
        <NotificationBell initialUnreadCount={notificationCount} />
      </div>
    </header>
  );
}

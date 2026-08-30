// components/layout/topbar.tsx
"use client";

import { Search, Menu } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSidebar } from "@/components/layout/sidebar-context";

export function Topbar({ pageTitle, notificationCount }: { pageTitle: string; notificationCount: number }) {
  const [query, setQuery] = useState("");
  const { open } = useSidebar();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-zinc-800 bg-[#0A0A0B]/95 px-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={open}
          aria-label="Open menu"
          className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate font-display text-base tracking-wide text-zinc-100 sm:text-lg">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, items, events…"
            className="w-56 rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800 lg:w-72"
          />
        </div>

        <ThemeToggle />
        <NotificationBell initialUnreadCount={notificationCount} />
      </div>
    </header>
  );
}

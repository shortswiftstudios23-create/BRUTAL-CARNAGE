// components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Rank } from "@prisma/client";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Wallet,
  CalendarDays,
  TrendingUp,
  ShieldAlert,
  Megaphone,
  FolderLock,
  Trophy,
  ChevronsUpDown,
  ArrowUpCircle,
  Users,
  ClipboardCheck,
  Store,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  visible?: (rank: Rank) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Admin panel",
    href: "/admin",
    icon: ClipboardCheck,
    visible: (r) => can(r, "canAccessAdminPanel"),
  },
  { label: "Members", href: "/members", icon: Users },
  { label: "Inventory", href: "/inventory", icon: Package },
  { label: "Family bank", href: "/money", icon: Wallet },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Performance", href: "/performance", icon: TrendingUp },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Promotions", href: "/promotions", icon: ArrowUpCircle },
  {
    label: "Discipline",
    href: "/discipline",
    icon: ShieldAlert,
    visible: (r) => can(r, "canViewReports"),
  },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  {
    label: "Evidence locker",
    href: "/evidence",
    icon: FolderLock,
    visible: (r) => can(r, "canViewReports"),
  },
];

export function Sidebar({
  userRank,
  username,
  avatarUrl,
}: {
  userRank: Rank;
  username: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.visible || item.visible(userRank));

  return (
    <aside className="relative flex h-screen w-64 flex-col border-r border-panel-border bg-panel">
      {/* Faint top-down crimson wash behind the crest — signals "brand"
          without printing a giant logo across the whole rail. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-crimson-dark/15 to-transparent" />

      <div className="relative flex items-center gap-3 border-b border-panel-border px-5 py-5">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-crimson-dark/50 shadow-glow-crimson">
          <Image src="/logo.png" alt="Brutal Carnage" fill className="object-cover" sizes="40px" priority />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-base tracking-wide text-zinc-100">
            BRUTAL CARNAGE
          </p>
          <p className="text-[10px] uppercase tracking-widest2 text-zinc-500">Grand RP · Family</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-gradient-to-r from-crimson-dark/25 to-transparent text-red-100"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              )}
            >
              {isActive && (
                <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-crimson shadow-glow-crimson" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-crimson-light" : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-panel-border p-3">
        <Link
          href="/settings"
          className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-panel-border bg-white/[0.04] text-xs font-semibold text-zinc-300">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={username} fill className="object-cover" sizes="36px" />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">{username}</p>
            <p className="truncate text-[11px] uppercase tracking-wide text-zinc-500">
              {userRank.replace(/_/g, " ")}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
        </Link>
      </div>
    </aside>
  );
}

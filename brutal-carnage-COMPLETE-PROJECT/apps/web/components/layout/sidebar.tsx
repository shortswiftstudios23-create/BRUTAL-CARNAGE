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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-[#0A0A0B]">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5">
        <div className="relative h-9 w-9 overflow-hidden rounded border border-red-800/60">
          <Image src="/logo.png" alt="Brutal Carnage" fill className="object-cover" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm tracking-wide text-zinc-100">BRUTAL CARNAGE</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Family system</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.visible || item.visible(userRank)).map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-red-950/40 text-red-200"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-red-400" : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_1px_rgba(220,38,38,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-zinc-900">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={username} width={32} height={32} className="rounded-full" />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">{username}</p>
            <p className="truncate text-[11px] text-zinc-500">{userRank.replace(/_/g, " ")}</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-600" />
        </button>
      </div>
    </aside>
  );
}

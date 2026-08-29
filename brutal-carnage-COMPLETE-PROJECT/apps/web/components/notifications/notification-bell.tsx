// components/notifications/notification-bell.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Megaphone, ArrowUpCircle, ShieldAlert, CalendarDays, Wallet, ClipboardCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "APPROVAL" | "PROMOTION" | "STRIKE" | "EVENT" | "ANNOUNCEMENT" | "BANK" | "SYSTEM";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<Notification["type"], React.ElementType> = {
  APPROVAL: ClipboardCheck,
  PROMOTION: ArrowUpCircle,
  STRIKE: ShieldAlert,
  EVENT: CalendarDays,
  ANNOUNCEMENT: Megaphone,
  BANK: Wallet,
  SYSTEM: Info,
};

// Where clicking a notification of this type should take the member —
// keeps the bell as a launcher into the relevant page, not a dead end.
const TYPE_LINK: Record<Notification["type"], string> = {
  APPROVAL: "/dashboard",
  PROMOTION: "/promotions",
  STRIKE: "/discipline",
  EVENT: "/events",
  ANNOUNCEMENT: "/announcements",
  BANK: "/money",
  SYSTEM: "/dashboard",
};

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setLoaded(true);
    } catch {
      // Silent — polling failure shouldn't surface an error toast every 30s.
    }
  }, []);

  // Poll unread count in the background regardless of open state, so the
  // badge stays live; only fetch the full feed when opened.
  useEffect(() => {
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleOpen() {
    setOpen((o) => {
      if (!o && !loaded) fetchNotifications();
      return !o;
    });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setOpen(false);
    router.push(TYPE_LINK[n.type]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggleOpen}
        className="relative rounded-md border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h3 className="text-sm font-medium text-zinc-200">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-600">You're all caught up.</p>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "flex w-full gap-3 border-b border-zinc-900 px-4 py-3 text-left last:border-0 hover:bg-zinc-900",
                      !n.read && "bg-red-950/10"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        n.read ? "bg-zinc-900 text-zinc-500" : "bg-red-950/50 text-red-400"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", n.read ? "text-zinc-400" : "font-medium text-zinc-100")}>
                        {n.title}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-zinc-600">
                        {new Date(n.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// components/events/event-card.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Users, Gift, Trophy, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventForm } from "./event-form";

export interface EventCardData {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  location?: string | null;
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
  result: "WIN" | "LOSS" | "NONE";
  isGiveaway: boolean;
  attendeeCount: number;
  isRegistered: boolean;
  createdByUsername: string;
  eventType?: string | null;
  bonusAmount?: number | null;
}

export function EventCard({ event, canManage }: { event: EventCardData; canManage: boolean }) {
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(false);

  const startsAt = new Date(event.startsAt);
  const isPast = startsAt.getTime() < Date.now();

  async function toggleRegister() {
    setRegistering(true);
    try {
      const res = await fetch(`/api/events/${event.id}/register`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.registered ? "You're registered" : "Registration cancelled");
      router.refresh();
    } catch {
      toast.error("Couldn't update your registration");
    } finally {
      setRegistering(false);
    }
  }

  async function drawWinner() {
    setDrawing(true);
    try {
      const res = await fetch(`/api/events/${event.id}/giveaway-draw`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Winner drawn: ${data.winner.username}`);
      router.refresh();
    } catch {
      toast.error("Couldn't draw a winner");
    } finally {
      setDrawing(false);
    }
  }

  return (
    <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            {event.isGiveaway && <Gift className="h-3.5 w-3.5 text-amber-400" />}
            <h3 className="font-display text-base tracking-wide text-zinc-100">{event.title}</h3>
            <StatusPill status={event.status} result={event.result} />
          </div>
          <p className="line-clamp-2 text-sm text-zinc-500">{event.description}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {startsAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </span>
        {event.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {event.attendeeCount} registered
        </span>
      </div>

      <div className="flex items-center gap-2">
        {event.status !== "COMPLETED" && event.status !== "CANCELLED" && (
          <button
            onClick={toggleRegister}
            disabled={registering}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
              event.isRegistered
                ? "border border-panel-border text-zinc-300 hover:bg-white/[0.04]"
                : "bg-gradient-to-r from-red-800 to-red-700 text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)]"
            )}
          >
            {registering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {event.isRegistered ? "Cancel registration" : "Register"}
          </button>
        )}

        {canManage && event.isGiveaway && event.status !== "COMPLETED" && (
          <button
            onClick={drawWinner}
            disabled={drawing || event.attendeeCount === 0}
            className="flex items-center gap-2 rounded-md border border-amber-800 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950/30 disabled:opacity-50"
          >
            {drawing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Trophy className="h-3.5 w-3.5" />
            Draw winner
          </button>
        )}

        {canManage && !event.isGiveaway && isPast && event.status !== "COMPLETED" && (
          <a
            href={`/events/${event.id}/close-out`}
            className="flex items-center gap-2 rounded-md border border-panel-border px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            Close out event
          </a>
        )}

        {canManage && event.status !== "COMPLETED" && event.status !== "CANCELLED" && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-md border border-panel-border px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      {editing && (
        <EventForm
          onClose={() => setEditing(false)}
          event={{
            id: event.id,
            title: event.title,
            description: event.description,
            startsAt: toDatetimeLocal(startsAt),
            location: event.location ?? undefined,
            isGiveaway: event.isGiveaway,
            eventType: event.eventType ?? undefined,
            bonusAmount: event.bonusAmount ?? undefined,
          }}
        />
      )}
    </div>
  );
}

// Formats a Date as the value a <input type="datetime-local"> expects,
// in local time (not UTC), so the edit form pre-fills to what was set.
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusPill({ status, result }: { status: EventCardData["status"]; result: EventCardData["result"] }) {
  if (status === "COMPLETED" && result !== "NONE") {
    return (
      <span
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
          result === "WIN"
            ? "border-green-900 bg-green-950/50 text-green-400"
            : "border-red-900 bg-red-950/50 text-red-400"
        )}
      >
        {result === "WIN" ? "Win" : "Loss"}
      </span>
    );
  }
  if (status === "LIVE") {
    return (
      <span className="rounded border border-red-800 bg-red-950/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-400">
        Live
      </span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="rounded border border-panel-border bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Cancelled
      </span>
    );
  }
  return null;
}

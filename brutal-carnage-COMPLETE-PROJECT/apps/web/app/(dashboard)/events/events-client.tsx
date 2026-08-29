// app/(dashboard)/events/events-client.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EventCard, EventCardData } from "@/components/events/event-card";
import { EventForm } from "@/components/events/event-form";

export function EventsClient({ events, canManage }: { events: EventCardData[]; canManage: boolean }) {
  const [showForm, setShowForm] = useState(false);

  const upcoming = events.filter((e) => e.status === "SCHEDULED" || e.status === "LIVE");
  const past = events.filter((e) => e.status === "COMPLETED" || e.status === "CANCELLED");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-xl tracking-wide text-zinc-100">Events</h1>
        {canManage && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 px-4 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)]"
          >
            <Plus className="h-4 w-4" />
            New event
          </button>
        )}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-600">No upcoming events right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Past</h2>
        {past.length === 0 ? (
          <p className="text-sm text-zinc-600">No past events yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {past.map((e) => (
              <EventCard key={e.id} event={e} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      {showForm && <EventForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

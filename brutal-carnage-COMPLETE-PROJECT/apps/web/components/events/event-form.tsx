// components/events/event-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Title is too short").max(120),
  description: z.string().min(3, "Add a short description").max(2000),
  startsAt: z.string().min(1, "Pick a start time"),
  location: z.string().max(120).optional(),
  isGiveaway: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export function EventForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", startsAt: "", location: "", isGiveaway: false },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, startsAt: new Date(values.startsAt).toISOString() }),
      });
      if (!res.ok) throw new Error();

      toast.success("Event created and announced to Discord");
      router.refresh();
      onClose();
    } catch {
      toast.error("Couldn't create the event. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide text-zinc-100">New event</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Title</label>
            <input
              {...register("title")}
              placeholder="Turf war — Vinewood block"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="What's happening, meet-up point, what to bring…"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            />
            {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Starts at</label>
              <input
                type="datetime-local"
                {...register("startsAt")}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
              />
              {errors.startsAt && <p className="mt-1 text-xs text-red-400">{errors.startsAt.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Location (optional)</label>
              <input
                {...register("location")}
                placeholder="Sandy Shores"
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" {...register("isGiveaway")} className="h-4 w-4 rounded border-zinc-700 bg-zinc-900" />
            This is a family-only giveaway (no win/loss, draws a random winner)
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_20px_-4px_rgba(220,38,38,0.5)] transition hover:shadow-[0_0_28px_-2px_rgba(220,38,38,0.7)] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create & announce
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

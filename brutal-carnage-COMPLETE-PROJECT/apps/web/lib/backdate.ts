// lib/backdate.ts
// Shared "log this for an earlier day" support for inventory actions and
// money transactions — lets someone submit today what actually happened
// yesterday or the day before, without it looking like they're logging
// something from the future or from further back than allowed.

import { z } from "zod";

export const MAX_BACKDATE_DAYS = 2; // today, yesterday, or the day before

export interface BackdateOption {
  label: string;
  daysAgo: number;
}

export function backdateOptions(): BackdateOption[] {
  return [
    { label: "Today", daysAgo: 0 },
    { label: "Yesterday", daysAgo: 1 },
    { label: "Day before yesterday", daysAgo: 2 },
  ];
}

// Validates an optional occurredAt: must be a real date, not in the
// future, and no further back than MAX_BACKDATE_DAYS.
export const occurredAtSchema = z
  .coerce.date()
  .optional()
  .refine(
    (date) => {
      if (!date) return true;
      const now = Date.now();
      const earliest = now - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000; // 1h grace
      return date.getTime() <= now + 60 * 1000 && date.getTime() >= earliest;
    },
    { message: `Date must be within the last ${MAX_BACKDATE_DAYS} days, not in the future.` }
  );

// The date actually shown/sorted-by everywhere in the UI: occurredAt if
// the member backdated the entry, otherwise the real createdAt.
export function effectiveDate(record: { createdAt: Date | string; occurredAt?: Date | string | null }): Date {
  return new Date(record.occurredAt ?? record.createdAt);
}

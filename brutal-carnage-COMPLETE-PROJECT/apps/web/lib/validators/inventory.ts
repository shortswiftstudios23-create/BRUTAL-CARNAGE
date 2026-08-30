// lib/validators/inventory.ts
import { z } from "zod";
import { occurredAtSchema } from "@/lib/backdate";

export const itemActionTypeSchema = z.enum(["DONATE", "TAKE", "ORDER"]);

// Only meaningful when type = TAKE. PERSONAL counts against the member's
// contribution total; FOR_SALE means the item is being pulled to list on
// the marketplace on the family's behalf and must NOT count against them
// (see lib/contributions.ts).
export const itemActionPurposeSchema = z.enum(["PERSONAL", "FOR_SALE"]);

// A single multi-select submission: some existing items by ID + quantity,
// and optionally brand-new items that don't exist in the catalog yet
// (these get routed to PendingItem approval instead of ItemAction).
export const submitInventoryActionSchema = z.object({
  type: itemActionTypeSchema,
  // Required (and only used) when type === "TAKE" — see itemActionPurposeSchema.
  purpose: itemActionPurposeSchema.optional(),
  existingItems: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
  newItems: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        suggestedPrice: z.number().nonnegative(),
        quantity: z.number().int().positive(),
      })
    )
    .default([]),
  note: z.string().max(500).optional(),
  // Optional: "log this for yesterday / the day before" — see lib/backdate.ts
  occurredAt: occurredAtSchema,
}).refine(
  (data) => data.existingItems.length > 0 || data.newItems.length > 0,
  { message: "Select at least one item or add a new one." }
).refine(
  (data) => data.type !== "TAKE" || !!data.purpose,
  { message: "Choose whether this is for personal use or to sell for the family.", path: ["purpose"] }
);

export type SubmitInventoryActionInput = z.infer<typeof submitInventoryActionSchema>;

export const approvePendingItemSchema = z.object({
  approve: z.boolean(),
  rejectionNote: z.string().max(300).optional(),
  // Admins reviewing a submission can correct the name/price before it
  // hits the catalog (e.g. fixing a typo or an unrealistic price).
  name: z.string().min(2).max(80).optional(),
  suggestedPrice: z.number().nonnegative().optional(),
});

// Bulk review: approve/reject many pending items in one call. Per-item
// name/price overrides aren't supported here (that needs the single-item
// edit flow) — bulk is for the common "these all look fine" case.
export const bulkReviewPendingItemsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  approve: z.boolean(),
});

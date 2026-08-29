// lib/validators/inventory.ts
import { z } from "zod";

export const itemActionTypeSchema = z.enum(["DONATE", "TAKE", "ORDER"]);

// A single multi-select submission: some existing items by ID + quantity,
// and optionally brand-new items that don't exist in the catalog yet
// (these get routed to PendingItem approval instead of ItemAction).
export const submitInventoryActionSchema = z.object({
  type: itemActionTypeSchema,
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
}).refine(
  (data) => data.existingItems.length > 0 || data.newItems.length > 0,
  { message: "Select at least one item or add a new one." }
);

export type SubmitInventoryActionInput = z.infer<typeof submitInventoryActionSchema>;

export const approvePendingItemSchema = z.object({
  approve: z.boolean(),
  rejectionNote: z.string().max(300).optional(),
});

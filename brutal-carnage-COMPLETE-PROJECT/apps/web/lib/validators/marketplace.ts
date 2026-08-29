// lib/validators/marketplace.ts
import { z } from "zod";

export const createResaleListingSchema = z.object({
  itemName: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  askingPrice: z.coerce.number().positive("Asking price must be greater than 0"),
  quantity: z.coerce.number().int().positive().default(1),
  // Only Deputy+ can set this true — enforced server-side, not just here.
  isFamilyStock: z.boolean().default(false),
  linkedItemId: z.string().cuid().optional(),
});

export type CreateResaleListingInput = z.infer<typeof createResaleListingSchema>;

export const updateResaleListingStatusSchema = z.object({
  status: z.enum(["SOLD", "CANCELLED"]),
});

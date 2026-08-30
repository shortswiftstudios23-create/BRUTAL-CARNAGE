// lib/validators/money.ts
import { z } from "zod";
import { occurredAtSchema } from "@/lib/backdate";

export const transactionTypeSchema = z.enum([
  "DONATION",
  "WITHDRAWAL",
  "FAMILY_BONUS",
  "FAMILY_RAID",
  "CARS_FUEL",
  "RECALLING_CARS",
  "INVESTMENT",
  "SOLD_ITEMS",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
]);

export const createTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    amount: z.number().positive(),
    note: z.string().max(500).optional(),
    // Only relevant/required when type === "SOLD_ITEMS"
    soldItemId: z.string().cuid().optional(),
    soldQuantity: z.number().int().positive().optional(),
    // Optional: "log this for yesterday / the day before" — see lib/backdate.ts
    occurredAt: occurredAtSchema,
  })
  .refine(
    (data) => data.type !== "SOLD_ITEMS" || (data.soldItemId && data.soldQuantity),
    { message: "Select which item was sold and how many units.", path: ["soldItemId"] }
  );

export const createBankRequestSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(5).max(500),
  category: z.enum(["GENERAL", "PERSONAL_EXPENSE"]).default("GENERAL"),
});

export const reviewBankRequestSchema = z.object({
  approve: z.boolean(),
  rejectionNote: z.string().max(300).optional(),
});

export const createLoanSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(5).max(500),
  // Optional items the member is offering as security for the loan.
  // Freeform name (not required to exist in the catalog) since a member
  // may be offering something not yet cataloged.
  collateralItems: z
    .array(
      z.object({
        itemId: z.string().cuid().optional(),
        itemName: z.string().min(1).max(80),
        quantity: z.number().int().positive().default(1),
      })
    )
    .max(20)
    .default([]),
});

export const reviewLoanSchema = z.object({
  approve: z.boolean(),
  rejectionNote: z.string().max(300).optional(),
  // Only used on approval — how many days from now the loan is due.
  // Defaults to 14 in the review route if omitted.
  dueInDays: z.number().int().positive().max(365).optional(),
});

export const repayLoanSchema = z.object({
  amount: z.number().positive(),
});

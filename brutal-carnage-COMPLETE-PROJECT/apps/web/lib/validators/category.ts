// lib/validators/category.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60, "Name is too long"),
  direction: z.enum(["INCOME", "EXPENSE"]),
  group: z.string().trim().max(40).optional().or(z.literal("")),
  icon: z.string().trim().max(10).optional().or(z.literal("")),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(),
  group: z.string().trim().max(40).optional().or(z.literal("")),
  icon: z.string().trim().max(10).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// lib/validators/content.ts
import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(3).max(120),
  content: z.string().min(1).max(4000),
  pinned: z.boolean().default(false),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  content: z.string().min(1).max(4000).optional(),
  pinned: z.boolean().optional(),
});

export const ruleItemSchema = z.object({
  id: z.string().optional(), // absent = new rule
  order: z.number().int().min(0),
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(4000),
});

export const saveRulesSchema = z.object({
  rules: z.array(ruleItemSchema).max(200),
});

export const createEvidenceSchema = z.object({
  url: z.string().url(),
  type: z.enum(["video", "image"]),
  title: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  relatedReportId: z.string().optional(),
});

export const widgetPrefSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  order: z.number().int().min(0),
});

export const saveWidgetPrefsSchema = z.object({
  widgets: z.array(widgetPrefSchema).max(50),
  setAsFamilyDefault: z.boolean().optional(), // Boss+ only, checked server-side
});

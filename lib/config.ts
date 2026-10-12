import { z } from "zod";
import showsJson from "@/config/shows.json";
import settingsJson from "@/config/settings.json";

/**
 * Monitored shows and run settings come from config/*.json, so changing the
 * show list is a JSON edit (plus the redeploy Vercel does on every push).
 */

const ShowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase-kebab-case"),
  name: z.string().min(1),
  rss_url: z.string().url(),
  enabled: z.boolean().default(true),
  /** The show's own company/network/fund: self-promotion, not sponsorship, so it is dropped from brands. */
  self_brands: z.array(z.string()).default([]),
});
export type Show = z.infer<typeof ShowSchema>;

const SettingsSchema = z.object({
  guest_window_days: z.number().int().positive().default(30),
  topic_window_days: z.number().int().positive().default(7),
  brand_window_days: z.number().int().positive().default(30),
  ingest_window_days: z.number().int().positive().default(35),
  recipients: z.array(z.string().email()).default([]),
  schedule: z
    .object({
      description: z.string().optional(),
      cron_utc: z.string(),
      timezone: z.string(),
    })
    .optional(),
  gemini: z
    .object({
      concurrency: z.number().int().min(1).max(10).default(2),
      max_retries: z.number().int().min(0).max(10).default(4),
      /** Minimum gap between request starts; 12500ms keeps us under a 5 RPM free tier. */
      min_interval_ms: z.number().int().min(0).default(12_500),
      /** Episodes sent per extraction call (batched to stay within request quotas). */
      episodes_per_call: z.number().int().min(1).max(20).default(8),
    })
    .default({ concurrency: 2, max_retries: 4, min_interval_ms: 12_500, episodes_per_call: 8 }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const allShows: Show[] = z
  .array(ShowSchema)
  .parse(showsJson)
  .filter((s, i, arr) => arr.findIndex((o) => o.id === s.id) === i);

export const enabledShows: Show[] = allShows.filter((s) => s.enabled);

export const settings: Settings = SettingsSchema.parse(settingsJson);

export const geminiModel = (): string => process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

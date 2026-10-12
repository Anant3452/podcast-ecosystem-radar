import { GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";
import type { z } from "zod";
import { geminiModel, settings } from "@/lib/config";

/**
 * The only LLM provider in this app: Google Gemini Flash via @google/genai.
 * Every call goes through `generateJson`, which enforces JSON mode with a
 * response schema, validates the result with Zod, and retries 429/5xx with
 * exponential backoff. A process-wide semaphore throttles concurrency.
 */

let ai: GoogleGenAI | undefined;
function client(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export const geminiStats = { calls: 0, retries: 0, failures: 0 };

// Simple counting semaphore so batches never exceed the configured concurrency.
let active = 0;
const waiters: (() => void)[] = [];
async function acquire(): Promise<void> {
  if (active < settings.gemini.concurrency) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release(): void {
  active--;
  waiters.shift()?.();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Space request starts at least `min_interval_ms` apart (free tier is ~5 RPM).
let nextSlot = 0;
async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + settings.gemini.min_interval_ms;
  if (at > now) await sleep(at - now);
}

/** Server-suggested wait from a 429 ("Please retry in 38.1s" / RetryInfo.retryDelay). */
function suggestedDelayMs(err: unknown): number | null {
  const msg = (err as { message?: string }).message ?? "";
  const m = msg.match(/retry in ([\d.]+)s/i) ?? msg.match(/"retryDelay":"([\d.]+)s"/);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

/** Daily quota exhaustion won't clear by retrying within this invocation. */
function dailyQuotaExhausted(err: unknown): boolean {
  return /PerDay|per_day|requests_per_day/i.test((err as { message?: string }).message ?? "");
}

function retryable(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string };
  const status = e.status ?? e.code;
  if (typeof status === "number") return status === 429 || status >= 500;
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|fetch failed|ECONNRESET|ETIMEDOUT/i.test(
    e.message ?? "",
  );
}

export { ThinkingLevel };

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  responseSchema: Schema;
  validator: z.ZodType<T>;
  temperature?: number;
  /** Extraction is mechanical, so it runs with LOW thinking for speed; the brief gets more. */
  thinking?: ThinkingLevel;
}): Promise<T> {
  const maxRetries = settings.gemini.max_retries;
  let attempt = 0;
  await acquire();
  try {
    for (;;) {
      try {
        await waitForSlot();
        geminiStats.calls++;
        const res = await client().models.generateContent({
          model: geminiModel(),
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseSchema: opts.responseSchema,
            temperature: opts.temperature ?? 0.2,
            thinkingConfig: { thinkingLevel: opts.thinking ?? ThinkingLevel.LOW },
          },
        });
        const text = res.text;
        if (!text) throw new Error("Gemini returned an empty response");
        return opts.validator.parse(JSON.parse(text));
      } catch (err) {
        if (attempt >= maxRetries || !retryable(err) || dailyQuotaExhausted(err)) {
          geminiStats.failures++;
          throw err;
        }
        geminiStats.retries++;
        const backoff = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
        const delay = Math.min(65_000, Math.max(backoff, suggestedDelayMs(err) ?? 0));
        attempt++;
        await sleep(delay);
      }
    }
  } finally {
    release();
  }
}

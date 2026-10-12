import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison of a provided secret against an env var. */
export function secretMatches(provided: string | null | undefined, envName: "CRON_SECRET" | "ADMIN_SECRET"): boolean {
  const expected = process.env[envName];
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
export function isCronRequest(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return secretMatches(auth.replace(/^Bearer\s+/i, ""), "CRON_SECRET");
}

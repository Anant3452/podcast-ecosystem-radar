import Link from "next/link";
import { listBriefs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Archive() {
  const briefs = await listBriefs();
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Archive</h1>
      <p className="mt-2 text-ink-2">Every weekly brief, newest first.</p>
      {briefs.length === 0 ? (
        <p className="mt-8 text-muted">No briefs yet.</p>
      ) : (
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {briefs.map((b) => (
            <li key={b.week_of}>
              <Link href={`/archive/${b.week_of}`} className="group grid gap-2 py-5 sm:grid-cols-[9rem_1fr_auto] sm:gap-6">
                <span className="font-mono text-sm text-muted">{b.week_of}</span>
                <span className="text-ink-2 group-hover:text-ink">{b.headline}</span>
                <span className="flex gap-2 text-xs">
                  <span className="rounded-full bg-guests-soft px-2 py-0.5 text-guests">{b.guests} guests</span>
                  <span className="rounded-full bg-topics-soft px-2 py-0.5 text-topics">{b.topics} topics</span>
                  <span className="rounded-full bg-sponsors-soft px-2 py-0.5 text-sponsors">{b.sponsors} brands</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

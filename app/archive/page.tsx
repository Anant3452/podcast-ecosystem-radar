import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { listBriefs } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmtWeek = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function Archive() {
  const briefs = await listBriefs();
  return (
    <div>
      <PageHeader eyebrow="Archive" title="Every weekly brief.">
        Newest first. Each brief is kept exactly as it was delivered.
      </PageHeader>

      <div className="mt-14">
        {briefs.length === 0 ? (
          <EmptyState title="No briefs yet">The first one is written on Monday at 6:00 AM IST.</EmptyState>
        ) : (
          <ol className="border-t border-border">
            {briefs.map((b, i) => (
              <li key={b.week_of} className="animate-rise border-b border-border" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link
                  href={`/archive/${b.week_of}`}
                  className="group -mx-4 grid gap-3 rounded-2xl px-4 py-6 transition-colors duration-300 ease-fluid hover:bg-surface sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-8"
                >
                  <time dateTime={b.week_of} className="font-mono text-xs text-muted">
                    {fmtWeek(b.week_of)}
                  </time>
                  <span className="leading-relaxed text-text-2 transition-colors duration-300 ease-fluid group-hover:text-text">
                    {b.headline}
                  </span>
                  <span className="flex items-center gap-4 text-xs text-muted">
                    <Count n={b.guests} label="guests" dot="bg-guests" />
                    <Count n={b.topics} label="topics" dot="bg-topics" />
                    <Count n={b.sponsors} label="brands" dot="bg-sponsors" />
                    <span
                      aria-hidden
                      className="ml-1 hidden text-faint transition-transform duration-300 ease-fluid group-hover:translate-x-1 group-hover:text-text sm:inline"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Count({ n, label, dot }: { n: number; label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      <span className="tabular-nums text-text-2">{n}</span> {label}
    </span>
  );
}

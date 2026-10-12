import Link from "next/link";
import { BriefView } from "@/components/BriefView";
import { latestBrief } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const brief = await latestBrief();
  if (!brief) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-10 text-center">
        <h1 className="font-display text-3xl font-semibold">No brief yet</h1>
        <p className="mt-3 text-ink-2">
          The first brief appears after the pipeline runs. Trigger it from{" "}
          <Link href="/admin" className="underline">
            Admin
          </Link>
          .
        </p>
      </div>
    );
  }
  return <BriefView brief={brief.content} emailedAt={brief.emailed_at} />;
}

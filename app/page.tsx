import Link from "next/link";
import { BriefView } from "@/components/BriefView";
import { PageHeader } from "@/components/ui";
import { latestBrief } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const brief = await latestBrief();
  if (!brief) {
    return (
      <PageHeader eyebrow="Podcast Ecosystem Radar" title="No brief yet.">
        The first brief appears after the pipeline runs. Trigger one from{" "}
        <Link href="/admin" className="text-text underline decoration-border-strong underline-offset-4 hover:decoration-current">
          Admin
        </Link>
        .
      </PageHeader>
    );
  }
  return <BriefView brief={brief.content} emailedAt={brief.emailed_at} />;
}

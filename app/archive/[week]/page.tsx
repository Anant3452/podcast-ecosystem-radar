import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "@/components/BriefView";
import { briefByWeek } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ArchivedBrief({ params }: PageProps<"/archive/[week]">) {
  const { week } = await params;
  const brief = await briefByWeek(week);
  if (!brief) notFound();
  return (
    <div>
      <Link href="/archive" className="mb-6 inline-block text-sm text-muted hover:text-ink">
        ← Archive
      </Link>
      <BriefView brief={brief.content} emailedAt={brief.emailed_at} />
    </div>
  );
}

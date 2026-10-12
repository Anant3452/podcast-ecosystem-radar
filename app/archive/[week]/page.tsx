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
      <Link
        href="/archive"
        className="group mb-6 inline-flex items-center gap-1.5 rounded-full text-sm text-muted transition-colors duration-200 ease-fluid hover:text-text"
      >
        <span aria-hidden className="transition-transform duration-300 ease-fluid group-hover:-translate-x-0.5">
          ←
        </span>
        Archive
      </Link>
      <BriefView brief={brief.content} emailedAt={brief.emailed_at} />
    </div>
  );
}

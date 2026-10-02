import Link from "next/link";
import { PageIntro } from "@/platform/ui/workspace/page-intro";
import { formatClock } from "@/platform/ui/workspace/format";
import { loadAppWorkspace } from "../../load-workspace";

export const metadata = {
  title: "Activity",
};

export default async function ActivityPage() {
  const { snapshot } = await loadAppWorkspace();

  return (
    <>
      <PageIntro
        title="Activity"
        body="Avery's work log. Only operational events are kept."
      />
      {snapshot.recentActivity.length === 0 ? (
        <p className="max-w-lg text-base leading-relaxed text-ink-soft">
          Nothing recorded yet. When Avery starts work, it will appear here.
        </p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {snapshot.recentActivity.map((item) => (
            <li
              key={item.id}
              className="grid gap-1 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
            >
              <p className="text-sm text-ink-soft">{formatClock(item.createdAt)}</p>
              <div>
                <p className="text-sm leading-relaxed text-ink">{item.summary}</p>
                {item.taskId ? (
                  <Link
                    href={`/employee/tasks/${item.taskId}`}
                    className="mt-1 inline-block text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    Open work
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

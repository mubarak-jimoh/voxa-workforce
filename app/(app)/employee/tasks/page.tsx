import Link from "next/link";
import { PageIntro } from "@/platform/ui/workspace/page-intro";
import { formatWhen, taskStatusLabel } from "@/platform/ui/workspace/format";
import { loadAppWorkspace } from "../../load-workspace";

export const metadata = {
  title: "Tasks",
};

export default async function TasksPage() {
  const { snapshot } = await loadAppWorkspace();

  return (
    <>
      <PageIntro
        title="Tasks"
        body="Work Avery has taken on. Open a piece of work to inspect the plan, activity and results."
      />
      {snapshot.tasks.length === 0 ? (
        <p className="max-w-lg text-base leading-relaxed text-ink-soft">
          No work yet. Tell Avery what you need from Home.
        </p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {snapshot.tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/employee/tasks/${task.id}`}
                className="block py-5 transition-colors hover:bg-paper-inset/60"
              >
                <p className="text-sm text-ink">{task.title}</p>
                <p className="mt-1.5 text-[0.7rem] tracking-[0.14em] text-ink-soft uppercase">
                  {taskStatusLabel(task.status)}
                  <span className="ml-3 font-normal normal-case tracking-normal">
                    {formatWhen(task.createdAt)}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

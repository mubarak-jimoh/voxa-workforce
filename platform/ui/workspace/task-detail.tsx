import Link from "next/link";
import type {
  Activity,
  Approval,
  Artifact,
  TaskStep,
  WorkTask,
} from "@/platform/db/schema";
import { ApprovalActions, ApprovalPayload } from "./approval-list";
import { ExecutionCard } from "./execution-card";
import { formatClock, formatWhen, taskStatusLabel } from "./format";
import { ResearchResultList } from "./research-results";

export function TaskDetail({
  task,
  steps,
  activity,
  artifacts,
  approvals,
}: {
  task: WorkTask;
  steps: TaskStep[];
  activity: Activity[];
  artifacts: Artifact[];
  approvals: Approval[];
}) {
  return (
    <article>
      <p className="text-sm text-ink-soft">
        <Link href="/employee/tasks" className="transition-colors hover:text-ink">
          Tasks
        </Link>
      </p>
      <h1 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-ink">
        {task.title}
      </h1>
      <p className="mt-4 text-[0.72rem] tracking-[0.16em] text-ink-soft uppercase">
        {taskStatusLabel(task.status)}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Requested by you · {formatWhen(task.createdAt)}
      </p>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-ink">
        {task.instruction}
      </p>

      <ExecutionCard
        task={task}
        steps={steps}
        artifacts={artifacts}
        approvals={approvals}
        hideOpen
      />

      {artifacts.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-[0.7rem] tracking-[0.16em] text-ink-soft uppercase">
            Results
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {artifacts.map((item) => (
              <li key={item.id} className="py-5">
                <p className="text-sm text-ink">{item.title}</p>
                {item.data?.type === "research_results" ? (
                  <ResearchResultList artifact={item} />
                ) : item.body ? (
                  <p className="mt-3 max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {item.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {approvals.length > 0 ? (
        <section className="mt-14">
          <h2 className="text-[0.7rem] tracking-[0.16em] text-ink-soft uppercase">
            Approvals
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {approvals.map((item) => (
              <li key={item.id} className="py-5">
                <p className="font-serif text-2xl text-ink">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.summary}</p>
                <ApprovalPayload payload={item.payload} />
                {item.status === "pending" ? (
                  <ApprovalActions approvalId={item.id} />
                ) : (
                  <p className="mt-3 text-sm text-ink-soft">
                    {item.status === "approved" ? "Approved" : "Rejected"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-14">
        <h2 className="text-[0.7rem] tracking-[0.16em] text-ink-soft uppercase">
          Activity
        </h2>
        {activity.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nothing recorded yet.</p>
        ) : (
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {activity.map((item) => (
              <li
                key={item.id}
                className="grid gap-1 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
              >
                <p className="text-sm text-ink-soft">{formatClock(item.createdAt)}</p>
                <p className="text-sm leading-relaxed text-ink">{item.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}


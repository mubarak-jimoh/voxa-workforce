import type { loadWorkspaceSnapshot } from "@/platform/work/queries";
import { ExecutionCard } from "./execution-card";
import { formatClock } from "./format";

type Snapshot = Awaited<ReturnType<typeof loadWorkspaceSnapshot>>;

export function ConversationThread({
  snapshot,
  employeeName,
}: {
  snapshot: Snapshot;
  employeeName: string;
}) {
  const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const shown = new Set<string>();
  const lastId = snapshot.messages.at(-1)?.id;

  return (
    <ol className="flex flex-col gap-9">
      {snapshot.messages.map((entry) => {
        const task = entry.taskId ? tasksById.get(entry.taskId) : undefined;
        const showWork =
          Boolean(task) &&
          entry.role === "employee" &&
          entry.taskId &&
          !shown.has(entry.taskId);
        if (showWork && entry.taskId) {
          shown.add(entry.taskId);
        }
        const you = entry.role === "user";
        const clock = formatClock(entry.createdAt);
        const latest = entry.id === lastId;
        return (
          <li key={entry.id} className={latest ? "voxa-arrive" : undefined}>
            {you ? (
              <div className="border-l-2 border-line-strong pl-4">
                <p
                  suppressHydrationWarning
                  className="text-[0.68rem] tracking-[0.16em] text-ink-soft uppercase"
                >
                  You
                  {clock ? (
                    <span className="ml-3 font-normal normal-case tracking-normal">
                      {clock}
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 max-w-xl text-[1.02rem] leading-relaxed text-ink-soft">
                  {entry.body}
                </p>
              </div>
            ) : (
              <div>
                <p
                  suppressHydrationWarning
                  className="text-[0.68rem] tracking-[0.16em] text-ink-soft uppercase"
                >
                  {employeeName}
                  {clock ? (
                    <span className="ml-3 font-normal normal-case tracking-normal">
                      {clock}
                    </span>
                  ) : null}
                </p>
                <MessageBody text={entry.body} />
                {showWork && task ? (
                  <div className="relative">
                    <span
                      className="absolute top-0 left-[9px] h-5 w-px bg-line-strong"
                      aria-hidden="true"
                    />
                    <ExecutionCard
                      task={task}
                      steps={snapshot.stepsByTaskId[task.id] ?? []}
                      artifacts={snapshot.artifactsByTaskId[task.id]}
                      approvals={snapshot.pendingApprovals.filter(
                        (item) => item.taskId === task.id,
                      )}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MessageBody({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="mt-2 max-w-[40rem] text-[1.08rem] leading-[1.7] text-ink">
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-medium text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

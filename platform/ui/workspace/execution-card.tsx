import Link from "next/link";
import { controlTaskAction } from "@/app/(app)/employee/actions";
import type { Artifact, Approval, TaskStep, WorkTask } from "@/platform/db/schema";
import { stepStatusLabel, taskStatusLabel } from "./format";
import { ResearchResultPreview } from "./research-results";

export function ExecutionCard({
  task,
  steps,
  artifacts,
  approvals,
  compact = false,
  hideOpen = false,
}: {
  task: WorkTask;
  steps: TaskStep[];
  artifacts?: Artifact[];
  approvals?: Approval[];
  compact?: boolean;
  hideOpen?: boolean;
}) {
  const current =
    steps.find((step) => step.status === "running") ??
    steps.find((step) => step.status === "blocked") ??
    steps.find((step) => step.status === "pending");
  const pendingApproval = approvals?.find((item) => item.status === "pending");
  const canPause = ["queued", "planning", "running"].includes(task.status);
  const canResume = task.status === "paused";
  const canCancel = [
    "queued",
    "planning",
    "running",
    "paused",
    "waiting_for_approval",
    "blocked",
  ].includes(task.status);
  const resultPreview = artifacts?.find(
    (item) => item.kind === "list" || item.kind === "dataset",
  );
  const researchWork =
    steps.some((step) => step.toolId === "web_research") ||
    Boolean(task.blockedReason?.toLowerCase().includes("web research")) ||
    Boolean(resultPreview);
  const live = ["queued", "planning", "running"].includes(task.status);

  return (
    <section
      className="voxa-work-arrive relative mt-5 overflow-hidden bg-paper-inset shadow-[var(--shadow-work)]"
      aria-label={`${task.title}, ${taskStatusLabel(task.status)}`}
    >
      <span
        className={`voxa-work-rail absolute inset-y-0 left-0 w-[3px] ${railTone(task.status)}`}
        aria-hidden="true"
      />
      <div className="px-5 py-4 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.95rem] leading-snug text-ink">{task.title}</p>
            <p className="mt-2 text-[0.7rem] tracking-[0.16em] text-ink-soft uppercase">
              {taskStatusLabel(task.status)}
              {current ? (
                <span className="normal-case tracking-normal">
                  <span aria-hidden="true"> · </span>
                  {current.title}
                </span>
              ) : null}
            </p>
          </div>
          <StepMark
            status={
              task.status === "running" || task.status === "planning"
                ? "running"
                : task.status === "blocked" || task.status === "failed"
                  ? "blocked"
                  : task.status === "completed"
                    ? "completed"
                    : task.status === "paused"
                      ? "paused"
                      : "pending"
            }
          />
        </div>

        {steps.length > 0 && !compact ? (
          <ol className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
            {steps.map((step) => (
              <li key={step.id} className="flex items-start gap-3 text-sm">
                <StepMark status={step.status} />
                <span
                  className={
                    step.status === "skipped" || step.status === "pending"
                      ? "text-ink-soft"
                      : "text-ink"
                  }
                >
                  {step.title}
                  <span className="sr-only">, {stepStatusLabel(step.status)}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {live ? (
          <p className="mt-4 text-sm text-ink-soft">
            {task.status === "planning"
              ? "Avery is planning this work."
              : "Avery is working…"}
          </p>
        ) : null}

        {task.blockedReason ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
            {task.blockedReason}
          </p>
        ) : null}

        {pendingApproval ? (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {pendingApproval.summary}
          </p>
        ) : null}

        {researchWork ? (
          <ResearchResultPreview
            artifact={resultPreview}
            emptyLabel={
              task.status === "blocked"
                ? "No companies yet."
                : resultPreview
                  ? resultPreview.title
                  : "Results will appear here when research produces them."
            }
          />
        ) : resultPreview ? (
          <p className="mt-4 text-sm text-ink-soft">{resultPreview.title}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {hideOpen ? null : (
            <Link
              href={`/employee/tasks/${task.id}`}
              className="text-accent transition-colors hover:text-accent-hover"
            >
              {pendingApproval ? "Review" : resultPreview ? "Open results" : "Open work"}
            </Link>
          )}
          {canPause ? <TaskControl taskId={task.id} action="pause" label="Pause" /> : null}
          {canResume ? <TaskControl taskId={task.id} action="resume" label="Resume" /> : null}
          {canCancel ? <TaskControl taskId={task.id} action="cancel" label="Cancel" /> : null}
        </div>
      </div>
    </section>
  );
}

function TaskControl({
  taskId,
  action,
  label,
}: {
  taskId: string;
  action: string;
  label: string;
}) {
  return (
    <form action={controlTaskAction}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className="text-ink-soft transition-colors hover:text-ink"
      >
        {label}
      </button>
    </form>
  );
}

export function StepMark({ status }: { status: string }) {
  const running = status === "running" || status === "planning";
  const done = status === "completed";
  const blocked = status === "blocked" || status === "failed";
  const skipped = status === "skipped";
  const paused = status === "paused";

  return (
    <span
      className={`mt-1.5 inline-block h-2 w-2 shrink-0 ${
        running
          ? "bg-accent voxa-pulse"
          : done
            ? "bg-accent"
            : blocked
              ? "bg-paused"
              : paused
                ? "bg-ink-soft"
                : skipped
                  ? "bg-line-strong"
                  : "border border-ink-soft/55 bg-transparent"
      }`}
      aria-hidden="true"
    />
  );
}

function railTone(status: string): string {
  if (status === "running" || status === "planning" || status === "queued") {
    return "bg-accent";
  }
  if (status === "waiting_for_approval") {
    return "bg-paused";
  }
  if (status === "blocked" || status === "failed") {
    return "bg-paused";
  }
  if (status === "paused") {
    return "bg-ink-soft";
  }
  if (status === "completed") {
    return "bg-accent/50";
  }
  return "bg-line-strong";
}


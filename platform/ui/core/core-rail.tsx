"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { coreMoodLabel, elapsedLabel } from "@/platform/work/core-state";
import { useCoreRuntime } from "./runtime";
import { VoxaCore } from "./voxa-core";

export function CoreRail() {
  const { view, focus, setFocus } = useCoreRuntime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (view.mood !== "working" && view.mood !== "planning") {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [view.mood]);

  const elapsed =
    view.mood === "working" || view.mood === "planning"
      ? elapsedLabel(view.startedAt, now)
      : null;

  return (
    <aside
      className={`hidden min-h-dvh flex-col border-l border-line bg-sidebar/80 px-6 py-8 xl:flex ${
        focus ? "xl:px-10" : ""
      }`}
      aria-label="Avery presence"
    >
      <div className="sticky top-8">
        <p className="text-[0.65rem] tracking-[0.18em] text-ink-soft uppercase">
          Avery
        </p>
        <p className="mt-2 font-serif text-2xl leading-none tracking-tight text-ink">
          {coreMoodLabel(view.mood)}
        </p>
        <p className="sr-only" aria-live="polite">
          {view.announcement}
        </p>
        <div className={`mt-6 flex justify-center ${focus ? "mt-10" : ""}`}>
          <VoxaCore view={view} size={focus ? "focus" : "rail"} />
        </div>
        <CoreFacts view={view} elapsed={elapsed} />
        {view.signals.length > 0 ? (
          <ol className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
            {view.signals.slice(0, focus ? 8 : 4).map((signal) => (
              <li key={signal.id} className="text-sm leading-relaxed text-ink-soft">
                {signal.label}
              </li>
            ))}
          </ol>
        ) : null}
        {view.result ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[0.65rem] tracking-[0.16em] text-ink-soft uppercase">
              Results
            </p>
            <p className="mt-2 text-sm text-ink">
              {view.result.found} {view.result.found === 1 ? "company" : "companies"}
              {` · ${view.result.verified} verified`}
              {view.result.needsReview > 0
                ? ` · ${view.result.needsReview} need review`
                : ""}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {view.result.names.slice(0, 3).map((name) => (
                <li key={name} className="text-sm text-ink-soft">
                  {name}
                </li>
              ))}
            </ul>
            {view.featuredTaskId ? (
              <Link
                href={`/employee/tasks/${view.featuredTaskId}`}
                className="mt-3 inline-block text-sm text-accent transition-colors hover:text-accent-hover"
              >
                Open research
              </Link>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setFocus(!focus)}
          className="mt-8 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          {focus ? "Back to conversation" : "View Avery working"}
        </button>
      </div>
    </aside>
  );
}

export function CoreFacts({
  view,
  elapsed,
}: {
  view: ReturnType<typeof useCoreRuntime>["view"];
  elapsed: string | null;
}) {
  const rows = [
    view.currentWork ? { label: "Current work", value: view.currentWork } : null,
    view.currentStep ? { label: "Step", value: view.currentStep } : null,
    view.toolLabel ? { label: "Tools", value: view.toolLabel } : null,
    elapsed ? { label: "Time", value: `Running ${elapsed}` } : null,
    ...view.metrics.map((metric) => ({ label: metric.label, value: metric.value })),
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm leading-relaxed text-ink-soft">
        Present and ready. Activity appears here when work is actually running.
      </p>
    );
  }

  return (
    <dl className="mt-6 flex flex-col gap-3">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`}>
          <dt className="text-[0.65rem] tracking-[0.16em] text-ink-soft uppercase">
            {row.label}
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MobileCoreStrip() {
  const { view, setFocus } = useCoreRuntime();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 xl:hidden">
      <div className="min-w-0">
        <p className="text-[0.68rem] tracking-[0.14em] text-ink-soft uppercase">
          {coreMoodLabel(view.mood)}
        </p>
        <p className="mt-1 truncate text-sm text-ink">
          {view.currentWork ?? view.announcement}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setFocus(true)}
        className="shrink-0 text-sm text-ink-soft hover:text-ink"
      >
        View
      </button>
    </div>
  );
}

export function FocusStage() {
  const { focus, setFocus, view } = useCoreRuntime();
  if (!focus) {
    return null;
  }
  return (
    <div className="mb-8 xl:hidden">
      <div className="flex items-center justify-between px-1 pb-4">
        <p className="font-serif text-2xl text-ink">{coreMoodLabel(view.mood)}</p>
        <button
          type="button"
          onClick={() => setFocus(false)}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Back to conversation
        </button>
      </div>
      <div className="flex justify-center">
        <VoxaCore view={view} size="rail" />
      </div>
      <CoreFacts
        view={view}
        elapsed={
          view.mood === "working" || view.mood === "planning"
            ? elapsedLabel(view.startedAt)
            : null
        }
      />
      {view.signals.length > 0 ? (
        <ol className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
          {view.signals.map((signal) => (
            <li key={signal.id} className="text-sm text-ink-soft">
              {signal.label}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

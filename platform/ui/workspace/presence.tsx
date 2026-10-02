import type { DisplayStatus } from "@/platform/work/constants";
import type { CoreMood } from "@/platform/work/core-state";
import { displayStatusLabel } from "@/platform/work/display-status";
import { AveryMark } from "../core/avery-mark";

export function moodFromDisplay(status: DisplayStatus): CoreMood {
  if (status === "working") {
    return "working";
  }
  if (status === "waiting") {
    return "waiting";
  }
  if (status === "paused") {
    return "paused";
  }
  return "ready";
}

export function statusToneFromMood(
  mood: CoreMood | undefined,
  fallback: DisplayStatus,
): DisplayStatus {
  if (mood === "paused") {
    return "paused";
  }
  if (mood === "waiting" || mood === "blocked") {
    return "waiting";
  }
  if (
    mood === "working" ||
    mood === "planning" ||
    mood === "understanding" ||
    mood === "listening" ||
    mood === "speaking"
  ) {
    return "working";
  }
  return fallback;
}

export function AveryPresence({
  status,
  mood,
  size = "md",
}: {
  status: DisplayStatus;
  mood?: CoreMood;
  size?: "sm" | "md" | "lg";
}) {
  return <AveryMark mood={mood ?? moodFromDisplay(status)} size={size} />;
}

export function StatusWord({
  status,
  label,
}: {
  status: DisplayStatus;
  label?: string;
}) {
  const tone =
    status === "working"
      ? "bg-accent voxa-pulse"
      : status === "waiting"
        ? "bg-paused"
        : status === "paused"
          ? "bg-ink-soft"
          : "bg-accent";

  return (
    <span className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.14em] text-ink-soft uppercase">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden="true" />
      <span>{label ?? displayStatusLabel(status)}</span>
    </span>
  );
}

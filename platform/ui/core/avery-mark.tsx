import { coreMoodLabel, type CoreMood } from "@/platform/work/core-state";

export function AveryMark({
  mood,
  size = "md",
}: {
  mood: CoreMood;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const live =
    mood === "working" ||
    mood === "planning" ||
    mood === "understanding" ||
    mood === "speaking" ||
    mood === "listening";
  const wait = mood === "waiting" || mood === "blocked";
  const paused = mood === "paused";
  const stroke = wait ? "stroke-paused" : paused ? "stroke-ink-soft" : "stroke-accent";
  const fill = wait ? "fill-paused" : paused ? "fill-ink-soft" : "fill-accent";

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex ${box} shrink-0 items-center justify-center`}
      title={coreMoodLabel(mood)}
    >
      <svg viewBox="0 0 44 44" className={`h-full w-full ${stroke}`}>
        <rect
          x="1"
          y="1"
          width="42"
          height="42"
          className="fill-paper-inset stroke-line-strong"
          strokeWidth="1"
        />
        <ellipse
          cx="22"
          cy="22"
          rx="16"
          ry="10"
          fill="none"
          strokeWidth="1"
          className="stroke-line-strong"
          opacity="0.7"
        />
        <ellipse
          cx="22"
          cy="22"
          rx="10"
          ry="16"
          fill="none"
          strokeWidth="1"
          className="stroke-line-strong"
          opacity="0.7"
        />
        <path d="M22 8 L34 22 L22 36 L10 22 Z" fill="none" strokeWidth="1.2" />
        <path
          d="M22 16 L28 22 L22 28 L16 22 Z"
          fill="none"
          strokeWidth="1.4"
          className={live ? "voxa-pulse" : undefined}
        />
        <path d="M19.5 22 L22 24.5 L22 17.5" fill="none" strokeWidth="1.4" />
        <circle cx="22" cy="8" r="1.1" className={fill} />
        <circle cx="34" cy="22" r="1.1" className={fill} />
        <circle cx="22" cy="36" r="1.1" className={fill} />
        <circle cx="10" cy="22" r="1.1" className={fill} />
      </svg>
    </span>
  );
}

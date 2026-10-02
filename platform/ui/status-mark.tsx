import type { EmployeeStatus } from "@/platform/employee/constants";

export function StatusMark({ status }: { status: EmployeeStatus }) {
  const label = status === "idle" ? "Ready" : status === "paused" ? "Paused" : "Offline";
  const tone =
    status === "idle" ? "bg-accent" : status === "paused" ? "bg-paused" : "bg-ink-soft";

  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

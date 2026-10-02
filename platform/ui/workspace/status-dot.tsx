import type { DisplayStatus } from "@/platform/work/constants";
import { AveryPresence, StatusWord } from "./presence";

export function StatusDot({
  status,
  label,
}: {
  status: DisplayStatus;
  label?: string;
}) {
  return <StatusWord status={status} label={label} />;
}

export function EmployeeMark({
  name,
  size = "md",
  status = "idle",
}: {
  name?: string;
  size?: "sm" | "md" | "lg";
  status?: DisplayStatus;
}) {
  void name;
  return <AveryPresence status={status} size={size === "md" ? "md" : size} />;
}

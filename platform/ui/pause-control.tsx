"use client";

import { useActionState } from "react";
import {
  toggleEmployeeStatusAction,
  type FormState,
} from "@/platform/actions/workspace";
import { canPauseEmployee } from "@/platform/membership/permissions";
import type { EmployeeStatus, MembershipRole } from "@/platform/employee/constants";

export function PauseControl({
  status,
  role,
}: {
  status: EmployeeStatus;
  role: MembershipRole;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    toggleEmployeeStatusAction,
    null,
  );

  if (!canPauseEmployee(role)) {
    return (
      <p className="text-sm text-ink-soft">
        Only an owner or admin can pause or resume this employee.
      </p>
    );
  }

  const label = status === "paused" ? "Resume" : "Pause";

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        className="text-sm text-ink-soft transition-colors hover:text-ink"
      >
        {label}
      </button>
      {state?.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

import type { TenantContext } from "@/platform/tenant/context";
import { PauseControl } from "./pause-control";
import { StatusMark } from "./status-mark";
import { WorkSurfaces } from "./work-surfaces";

export function EmployeeHome({
  tenant,
  roleLabel,
}: {
  tenant: TenantContext;
  roleLabel: string;
}) {
  const { employee, organisation } = tenant;
  const availability =
    employee.status === "paused"
      ? `${employee.name} is paused and will not take new work.`
      : `${employee.name} is idle and ready when work exists.`;

  return (
    <div className="pt-10 pb-20">
      <p className="text-sm text-ink-soft">Your employee</p>
      <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-5xl leading-none tracking-tight text-ink sm:text-6xl">
            {employee.name}
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            {roleLabel}
            <span aria-hidden="true"> · </span>
            {organisation.name}
          </p>
          <div className="mt-3">
            <StatusMark status={employee.status} />
          </div>
        </div>
        <PauseControl status={employee.status} role={tenant.membershipRole} />
      </div>
      <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-soft">
        {availability} Work surfaces below are ready; there is no activity yet.
      </p>
      <WorkSurfaces employeeName={employee.name} />
    </div>
  );
}

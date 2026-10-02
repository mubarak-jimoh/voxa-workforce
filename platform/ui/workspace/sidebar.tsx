import { signOutAction } from "@/platform/auth/actions";
import { canPauseEmployee } from "@/platform/membership/permissions";
import type { TenantContext } from "@/platform/tenant/context";
import type { DisplayStatus } from "@/platform/work/constants";
import { coreMoodLabel, type CoreMood } from "@/platform/work/core-state";
import { WordmarkText } from "../brand/wordmark";
import { PauseControl } from "../pause-control";
import { IdentityLink, NavLink } from "./nav-link";
import { AveryPresence, StatusWord, statusToneFromMood } from "./presence";

type Item = { href: string; label: string; match: string };

const WORK: Item[] = [
  { href: "/employee/tasks", label: "Tasks", match: "tasks" },
  { href: "/employee/activity", label: "Activity", match: "activity" },
  { href: "/employee/inbox", label: "Approvals", match: "inbox" },
  { href: "/employee/schedule", label: "Schedule", match: "schedule" },
];

const WORKSPACE: Item[] = [
  { href: "/employee/knowledge", label: "Knowledge", match: "knowledge" },
  { href: "/employee/connections", label: "Connections", match: "connections" },
];

export function WorkspaceSidebar({
  tenant,
  roleLabel,
  displayStatus,
  mood,
  presence,
  approvalCount,
}: {
  tenant: TenantContext;
  roleLabel: string;
  roleSummary?: string;
  displayStatus: DisplayStatus;
  mood?: CoreMood;
  presence: string;
  approvalCount: number;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <WordmarkText size="sm" />
      </div>
      <div className="mt-7 border-y border-line pt-6 pb-5">
        <IdentityLink>
          <div className="flex items-start gap-3.5">
            <AveryPresence status={displayStatus} mood={mood} size="lg" />
            <div className="min-w-0 pt-0.5">
              <p className="font-serif text-[1.85rem] leading-none tracking-tight text-ink">
                {tenant.employee.name}
              </p>
              <p className="mt-2 text-sm text-ink-soft">{roleLabel}</p>
              <div className="mt-3">
                <StatusWord
                  status={statusToneFromMood(mood, displayStatus)}
                  label={mood ? coreMoodLabel(mood) : undefined}
                />
              </div>
            </div>
          </div>
        </IdentityLink>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-ink">{presence}</p>
        {canPauseEmployee(tenant.membershipRole) ? (
          <div className="mt-3">
            <PauseControl
              status={tenant.employee.status}
              role={tenant.membershipRole}
            />
          </div>
        ) : null}
      </div>
      <nav className="mt-8 flex flex-col gap-7 text-sm" aria-label="Workspace">
        <NavGroup title="Work" items={WORK} approvalCount={approvalCount} />
        <NavGroup title="Workspace" items={WORKSPACE} />
      </nav>
      <div className="mt-auto border-t border-line pt-6 text-sm">
        <p className="text-ink">{tenant.organisation.name}</p>
        <p className="mt-1 text-ink-soft">{tenant.userName}</p>
        <div className="mt-4 flex flex-col items-start gap-2">
          <NavLink href="/settings" label="Settings" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-ink-soft transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function NavGroup({
  title,
  items,
  approvalCount,
}: {
  title: string;
  items: Item[];
  approvalCount?: number;
}) {
  return (
    <div>
      <p className="mb-2.5 text-[0.65rem] tracking-[0.18em] text-ink-soft uppercase">
        {title}
      </p>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              match={item.match}
              label={
                item.match === "inbox" && approvalCount
                  ? `${item.label} · ${approvalCount}`
                  : item.label
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

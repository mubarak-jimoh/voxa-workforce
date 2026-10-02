import type { TenantContext } from "@/platform/tenant/context";
import type { DisplayStatus } from "@/platform/work/constants";
import type { loadWorkspaceSnapshot } from "@/platform/work/queries";
import { FocusStage, MobileCoreStrip } from "../core/core-rail";
import { CommandComposer, type SuggestedPrompt } from "./composer";
import { AveryPresence, StatusWord } from "./presence";
import { ConversationThread } from "./thread";

type Snapshot = Awaited<ReturnType<typeof loadWorkspaceSnapshot>>;

export function AveryHome({
  tenant,
  roleLabel,
  snapshot,
  suggestions,
}: {
  tenant: TenantContext;
  roleLabel: string;
  snapshot: Snapshot;
  suggestions: readonly SuggestedPrompt[];
}) {
  const empty = snapshot.messages.length === 0 && snapshot.tasks.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {empty ? null : <MobileCoreStrip />}
      <FocusStage />
      <div className="flex min-h-0 flex-1 flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col justify-end pb-2">
            <EmptyGuide
              employeeName={tenant.employee.name}
              roleLabel={roleLabel}
              displayStatus={snapshot.displayStatus}
              paused={tenant.employee.status === "paused"}
            />
          </div>
        ) : (
          <div className="pb-6">
            <ConversationThread
              snapshot={snapshot}
              employeeName={tenant.employee.name}
            />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 mt-8 bg-paper pt-4 pb-1">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-paper"
          aria-hidden="true"
        />
        <CommandComposer
          employeeName={tenant.employee.name}
          paused={tenant.employee.status === "paused"}
          suggestions={empty ? suggestions : []}
        />
      </div>
    </div>
  );
}

function EmptyGuide({
  employeeName,
  roleLabel,
  displayStatus,
  paused,
}: {
  employeeName: string;
  roleLabel: string;
  displayStatus: DisplayStatus;
  paused: boolean;
}) {
  return (
    <div className="flex max-w-lg flex-col justify-end pt-4 lg:pt-16">
      <div className="flex items-start gap-4 lg:hidden">
        <AveryPresence status={displayStatus} size="lg" />
        <div>
          <p className="font-serif text-3xl leading-none tracking-tight text-ink">
            {employeeName}
          </p>
          <p className="mt-2 text-sm text-ink-soft">{roleLabel}</p>
          <div className="mt-3">
            <StatusWord status={displayStatus} />
          </div>
        </div>
      </div>
      <p className="mt-8 font-serif text-3xl leading-snug tracking-tight text-ink lg:mt-0 lg:text-[2.6rem]">
        {paused ? `${employeeName} is paused.` : "Ready when you are."}
      </p>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        Tell me what you&apos;re trying to get done and I&apos;ll turn it into work.
        I won&apos;t invent research or send anything I can&apos;t actually do.
      </p>
    </div>
  );
}

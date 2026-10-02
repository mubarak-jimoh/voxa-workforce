import { presenceLine } from "@/platform/work/display-status";
import type { TenantContext } from "@/platform/tenant/context";
import type { DisplayStatus } from "@/platform/work/constants";
import type { CoreView } from "@/platform/work/core-state";
import { WordmarkText } from "../brand/wordmark";
import { CoreRuntimeProvider } from "../core/runtime";
import { WorkspaceChrome } from "./chrome";
import { WorkspaceFrame } from "./frame";
import { AveryPresence, StatusWord, statusToneFromMood } from "./presence";
import { coreMoodLabel } from "@/platform/work/core-state";
import { WorkspaceSidebar } from "./sidebar";
import { WorkLiveRefresh } from "./live-refresh";

export function WorkspaceShell({
  tenant,
  roleLabel,
  roleSummary,
  displayStatus,
  workingTitle,
  approvalCount,
  coreView,
  children,
}: {
  tenant: TenantContext;
  roleLabel: string;
  roleSummary?: string;
  displayStatus: DisplayStatus;
  workingTitle?: string | null;
  approvalCount: number;
  coreView: CoreView;
  children: React.ReactNode;
}) {
  const presence =
    coreView.mood === "blocked" && coreView.currentWork
      ? `Can't continue — ${coreView.currentWork}`
      : presenceLine({
          status: displayStatus,
          employeeName: tenant.employee.name,
          workingTitle,
          waitingCount: approvalCount,
        });

  return (
    <CoreRuntimeProvider view={coreView}>
      <WorkLiveRefresh
        active={
          coreView.mood === "working" ||
          coreView.mood === "planning" ||
          displayStatus === "working"
        }
      />
      <WorkspaceFrame
        chrome={
          <WorkspaceChrome
            brand={<WordmarkText size="sm" />}
            presence={
              <div className="flex min-w-0 items-center gap-2.5">
                <AveryPresence status={displayStatus} mood={coreView.mood} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg leading-none text-ink">
                    {tenant.employee.name}
                  </p>
                  <div className="mt-1.5">
                    <StatusWord
                      status={statusToneFromMood(coreView.mood, displayStatus)}
                      label={coreMoodLabel(coreView.mood)}
                    />
                  </div>
                </div>
              </div>
            }
            sidebar={
              <WorkspaceSidebar
                tenant={tenant}
                roleLabel={roleLabel}
                roleSummary={roleSummary}
                displayStatus={displayStatus}
                mood={coreView.mood}
                presence={presence}
                approvalCount={approvalCount}
              />
            }
          />
        }
      >
        {children}
      </WorkspaceFrame>
    </CoreRuntimeProvider>
  );
}

import { loadAppWorkspace } from "./load-workspace";
import { WorkspaceShell } from "@/platform/ui/workspace/shell";
import { deriveCoreView } from "@/platform/work/core-state";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant, snapshot, roleLabel, roleSummary } = await loadAppWorkspace();
  const coreView = deriveCoreView({
    employeePaused: tenant.employee.status === "paused",
    displayStatus: snapshot.displayStatus,
    tasks: snapshot.tasks,
    steps: Object.values(snapshot.stepsByTaskId).flat(),
    activity: snapshot.recentActivity,
    artifacts: Object.values(snapshot.artifactsByTaskId).flat(),
    pendingApprovals: snapshot.counts.needsApproval,
  });

  return (
    <WorkspaceShell
      tenant={tenant}
      roleLabel={roleLabel}
      roleSummary={roleSummary}
      displayStatus={snapshot.displayStatus}
      workingTitle={snapshot.working[0]?.title ?? snapshot.queued[0]?.title}
      approvalCount={snapshot.counts.needsApproval}
      coreView={coreView}
    >
      {children}
    </WorkspaceShell>
  );
}

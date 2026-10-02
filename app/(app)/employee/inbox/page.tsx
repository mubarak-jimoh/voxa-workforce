import { ApprovalList } from "@/platform/ui/workspace/approval-list";
import { PageIntro } from "@/platform/ui/workspace/page-intro";
import { loadAppWorkspace } from "../../load-workspace";

export const metadata = {
  title: "Approvals",
};

export default async function InboxPage() {
  const { snapshot } = await loadAppWorkspace();

  return (
    <>
      <PageIntro
        title="Approvals"
        body="Consequential actions wait here. Nothing is sent until you decide, and only if the tool is actually connected."
      />
      <ApprovalList items={snapshot.pendingApprovals} />
    </>
  );
}

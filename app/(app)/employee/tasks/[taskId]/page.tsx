import { notFound } from "next/navigation";
import { TaskDetail } from "@/platform/ui/workspace/task-detail";
import {
  listActivity,
  listApprovalsForTask,
  listArtifactsForTask,
  listStepsForTask,
  getTaskForScope,
} from "@/platform/work/queries";
import { loadAppWorkspace } from "../../../load-workspace";

export const metadata = {
  title: "Task",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { scope } = await loadAppWorkspace();
  const task = await getTaskForScope(scope, taskId);
  if (!task) {
    notFound();
  }
  const [steps, activity, artifacts, approvals] = await Promise.all([
    listStepsForTask(scope, task.id),
    listActivity(scope, task.id),
    listArtifactsForTask(scope, task.id),
    listApprovalsForTask(scope, task.id),
  ]);

  return (
    <TaskDetail
      task={task}
      steps={steps}
      activity={activity}
      artifacts={artifacts}
      approvals={approvals}
    />
  );
}

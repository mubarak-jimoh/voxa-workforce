import { toggleScheduleAction } from "@/app/(app)/employee/actions";
import { PageIntro } from "@/platform/ui/workspace/page-intro";
import { formatWhen } from "@/platform/ui/workspace/format";
import { loadAppWorkspace } from "../../load-workspace";

export const metadata = {
  title: "Schedule",
};

export default async function SchedulePage() {
  const { snapshot } = await loadAppWorkspace();

  return (
    <>
      <PageIntro
        title="Schedule"
        body="Recurring instructions can be saved here. They will not run by themselves until a live scheduler is connected."
      />
      {snapshot.schedules.length === 0 ? (
        <p className="max-w-lg text-base leading-relaxed text-ink-soft">
          No schedules yet. Try asking Avery to do something every Monday.
        </p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {snapshot.schedules.map((item) => (
            <li key={item.id} className="py-6">
              <p className="text-sm text-ink">{item.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{item.cadence}</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                {item.instruction}
              </p>
              <p className="mt-3 text-sm text-ink-soft">
                {item.schedulerLive
                  ? "This schedule can run automatically."
                  : "Saved, but not running automatically."}
                {item.enabled ? "" : " Currently disabled."}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Next run {formatWhen(item.nextRunAt)} · Last run{" "}
                {formatWhen(item.lastRunAt)}
              </p>
              <form action={toggleScheduleAction} className="mt-4">
                <input type="hidden" name="scheduleId" value={item.id} />
                <input
                  type="hidden"
                  name="enabled"
                  value={item.enabled ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="text-sm text-ink-soft transition-colors hover:text-ink"
                >
                  {item.enabled ? "Disable" : "Enable"}
                </button>
              </form>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const SURFACES = [
  {
    title: "Assigned",
    body: "Nothing assigned yet. When you give work, it will appear here.",
  },
  {
    title: "Queued",
    body: "No queued work.",
  },
  {
    title: "Scheduled",
    body: "Nothing scheduled.",
  },
  {
    title: "Waiting for approval",
    body: "Nothing waiting for your approval.",
  },
  {
    title: "Completed today",
    body: "No work completed today.",
  },
  {
    title: "Blocked",
    body: "Nothing is blocked.",
  },
] as const;

export function WorkSurfaces({ employeeName }: { employeeName: string }) {
  return (
    <section aria-label={`${employeeName}'s work`} className="mt-16">
      <ol className="divide-y divide-line border-y border-line">
        {SURFACES.map((surface) => (
          <li key={surface.title} className="grid gap-2 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-10">
            <h2 className="text-sm text-ink">{surface.title}</h2>
            <p className="text-sm leading-relaxed text-ink-soft">{surface.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

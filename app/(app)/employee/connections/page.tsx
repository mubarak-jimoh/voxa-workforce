import { PageIntro } from "@/platform/ui/workspace/page-intro";

export const metadata = {
  title: "Connections",
};

const TOOLS = [
  { name: "Web research", status: "Not connected" },
  { name: "Contact lookup", status: "Not connected" },
  { name: "Outreach drafting", status: "Not connected" },
  { name: "Email send", status: "Not connected" },
] as const;

export default function ConnectionsPage() {
  return (
    <>
      <PageIntro
        title="Connections"
        body="Tools Avery can use. Unavailable tools are recorded honestly instead of faked."
      />
      <ul className="divide-y divide-line border-y border-line">
        {TOOLS.map((tool) => (
          <li
            key={tool.name}
            className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"
          >
            <p className="text-sm text-ink">{tool.name}</p>
            <p className="text-sm text-ink-soft">{tool.status}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

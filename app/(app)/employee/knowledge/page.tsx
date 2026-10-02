import { PageIntro } from "@/platform/ui/workspace/page-intro";

export const metadata = {
  title: "Knowledge",
};

export default function KnowledgePage() {
  return (
    <>
      <PageIntro
        title="Knowledge"
        body="Notes, documents and remembered context for this employee will live here."
      />
      <p className="max-w-lg text-base leading-relaxed text-ink-soft">
        No knowledge base is connected yet. Avery will not invent company facts or
        remembered files.
      </p>
    </>
  );
}

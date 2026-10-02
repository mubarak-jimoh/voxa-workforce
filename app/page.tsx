import { getAuth } from "@/platform/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Wordmark } from "@/platform/ui/brand/wordmark";
import { ensureMigrated } from "@/platform/tenant/load";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureMigrated();
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/employee");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-16">
      <Wordmark href="/" size="md" />
      <h1 className="mt-10 font-serif text-5xl leading-tight tracking-tight text-ink">
        Hire an employee who does the work.
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
        Speak to Avery naturally. Give work. Come back to see what got done,
        what needs you, and what is waiting.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
        <a
          className="bg-accent px-4 py-2 text-on-accent transition-colors hover:bg-accent-hover"
          href="/sign-up"
        >
          Create organisation
        </a>
        <a className="text-ink-soft transition-colors hover:text-ink" href="/sign-in">
          Sign in
        </a>
      </div>
    </main>
  );
}

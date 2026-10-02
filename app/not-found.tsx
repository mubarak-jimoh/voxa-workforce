import { Wordmark } from "@/platform/ui/brand/wordmark";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark href="/" />
      <h1 className="mt-10 font-serif text-4xl tracking-tight text-ink">Page not found</h1>
      <p className="mt-4 text-base text-ink-soft">
        That page does not exist. Return to Avery or sign in.
      </p>
      <a href="/employee" className="mt-8 self-start text-sm text-accent transition-colors hover:text-accent-hover">
        Go to Avery
      </a>
    </main>
  );
}

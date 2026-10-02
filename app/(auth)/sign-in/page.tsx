import { redirectIfAuthenticated } from "@/platform/tenant/load";
import { Wordmark } from "@/platform/ui/brand/wordmark";
import { SignInForm } from "@/platform/ui/auth-forms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/employee";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark href="/" />
      <h1 className="mt-10 font-serif text-4xl tracking-tight text-ink">Sign in</h1>
      <SignInForm nextPath={nextPath} />
      <p className="mt-10 text-sm text-ink-soft">
        No organisation yet?{" "}
        <a className="text-accent transition-colors hover:text-accent-hover" href="/sign-up">
          Create one
        </a>
      </p>
    </main>
  );
}

import { redirectIfAuthenticated } from "@/platform/tenant/load";
import { Wordmark } from "@/platform/ui/brand/wordmark";
import { SignUpForm } from "@/platform/ui/auth-forms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create organisation",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : undefined;
  await redirectIfAuthenticated(nextPath?.startsWith("/invite/") ? nextPath : "/employee");

  const joiningViaInvite = Boolean(nextPath?.startsWith("/invite/"));

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark href="/" />
      <h1 className="mt-10 font-serif text-4xl tracking-tight text-ink">
        {joiningViaInvite ? "Create your account" : "Hire your first employee"}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        {joiningViaInvite
          ? "Use the email this invitation was sent to. You will join the existing organisation."
          : "Create an organisation. Avery will be ready to take work."}
      </p>
      <SignUpForm nextPath={nextPath} />
      <p className="mt-10 text-sm text-ink-soft">
        Already have an account?{" "}
        <a
          className="text-accent transition-colors hover:text-accent-hover"
          href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"}
        >
          Sign in
        </a>
      </p>
    </main>
  );
}

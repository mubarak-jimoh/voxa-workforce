import { readyDatabase } from "@/platform/db";
import { getInvitationById } from "@/platform/organisation/invitations";
import { getOrganisationById } from "@/platform/organisation/commands";
import { getSession } from "@/platform/auth/session";
import { acceptInvitationAction } from "@/platform/actions/workspace";
import { Wordmark } from "@/platform/ui/brand/wordmark";
import { ensureMigrated } from "@/platform/tenant/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invitation",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  await ensureMigrated();
  const { invitationId } = await params;
  const db = await readyDatabase();
  const invite = await getInvitationById(db, invitationId);
  const session = await getSession();

  if (!invite || invite.status !== "pending") {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <h1 className="font-serif text-4xl text-ink">Invitation unavailable</h1>
        <p className="mt-4 text-base text-ink-soft">
          This invitation is missing, expired, or already used.
        </p>
      </main>
    );
  }

  const organisation = await getOrganisationById(db, invite.organizationId);

  if (!session) {
    const next = `/invite/${invitationId}`;
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <Wordmark href="/" />
        <h1 className="mt-10 font-serif text-4xl tracking-tight text-ink">You are invited</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          {organisation?.name ?? "An organisation"} invited {invite.email} as {invite.role}.
          Sign in or create an account with that email to accept.
        </p>
        <div className="mt-8 flex gap-6 text-sm">
          <a className="text-accent underline-offset-4 hover:underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>
            Sign in
          </a>
          <a className="text-accent underline-offset-4 hover:underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>
            Create account
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-4xl text-ink">Join {organisation?.name ?? "organisation"}</h1>
      <p className="mt-4 text-base text-ink-soft">
        This invitation was sent to {invite.email}. You are signed in as {session.user.email}.
      </p>
      <form action={acceptInvitationAction} className="mt-8">
        <input type="hidden" name="invitationId" value={invitationId} />
        <button type="submit" className="bg-accent px-4 py-2 text-sm text-on-accent transition-colors hover:bg-accent-hover">
          Accept invitation
        </button>
      </form>
    </main>
  );
}

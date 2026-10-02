"use client";

import { useActionState } from "react";
import {
  inviteMemberAction,
  renameOrganisationAction,
  type FormState,
} from "@/platform/actions/workspace";
import { canInviteMembers, canUpdateOrganisation } from "@/platform/membership/permissions";
import type { TenantContext } from "@/platform/tenant/context";

type MemberRow = {
  membershipId: string;
  role: string;
  name: string;
  email: string;
};

export function SettingsPanel({
  tenant,
  members,
  inviteId,
  origin,
}: {
  tenant: TenantContext;
  members: MemberRow[];
  inviteId?: string;
  origin: string;
}) {
  const [renameState, renameAction] = useActionState<FormState, FormData>(
    renameOrganisationAction,
    null,
  );
  const [inviteState, inviteAction] = useActionState<FormState, FormData>(
    inviteMemberAction,
    null,
  );

  const canRename = canUpdateOrganisation(tenant.membershipRole);
  const canInvite = canInviteMembers(tenant.membershipRole);
  const inviteUrl = inviteId ? `${origin}/invite/${inviteId}` : null;
  const roleLabel = formatRole(tenant.membershipRole);

  return (
    <div className="flex max-w-xl flex-col gap-14 pb-16">
      <div>
        <p className="text-sm text-ink-soft">Organisation</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">{tenant.organisation.name}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Signed in as {tenant.userEmail} · {roleLabel}
        </p>
      </div>

      <section>
        <h2 className="text-sm text-ink">Organisation name</h2>
        {canRename ? (
          <form action={renameAction} className="mt-4 flex flex-col gap-3">
            <label className="sr-only" htmlFor="org-name">
              Organisation name
            </label>
            <input
              id="org-name"
              name="name"
              defaultValue={tenant.organisation.name}
              required
              minLength={2}
              className="border-b border-line bg-transparent py-2 text-base outline-none"
            />
            <button type="submit" className="self-start bg-accent px-3 py-1.5 text-sm text-on-accent transition-colors hover:bg-accent-hover">
              Save name
            </button>
            {renameState?.error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {renameState.error}
              </p>
            ) : null}
            {renameState?.success ? (
              <p className="text-sm text-ink-soft">{renameState.success}</p>
            ) : null}
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Only the owner can rename the organisation.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm text-ink">People</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {members.map((person) => (
            <li key={person.membershipId} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-ink">{person.name}</p>
                <p className="text-sm text-ink-soft">{person.email}</p>
              </div>
              <p className="text-sm text-ink-soft">{formatRole(person.role)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm text-ink">Invite a member</h2>
        {canInvite ? (
          <form action={inviteAction} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-ink-soft">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="border-b border-line bg-transparent py-2 text-base text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-ink-soft">
              Role
              <select
                name="role"
                defaultValue="member"
                className="border-b border-line bg-transparent py-2 text-base text-ink outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" className="self-start bg-accent px-3 py-1.5 text-sm text-on-accent transition-colors hover:bg-accent-hover">
              Create invite link
            </button>
            {inviteState?.error ? (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {inviteState.error}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            Members cannot invite others. Ask an owner or admin.
          </p>
        )}
        {inviteUrl ? (
          <div className="mt-6">
            <p className="text-sm text-ink">Share this link</p>
            <p className="mt-2 break-all text-sm text-ink-soft">{inviteUrl}</p>
            <p className="mt-3 text-sm text-ink-soft">
              Email sending is not configured yet. Copy the link and send it yourself.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatRole(role: string): string {
  if (role === "owner") {
    return "Owner";
  }
  if (role === "admin") {
    return "Admin";
  }
  if (role === "member") {
    return "Member";
  }
  return role;
}

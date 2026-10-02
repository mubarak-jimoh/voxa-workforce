"use client";

import { useActionState } from "react";
import {
  signInAction,
  signUpAction,
  type AuthActionState,
} from "@/platform/auth/actions";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="border-b border-line bg-transparent py-2 text-base text-ink outline-none"
      />
    </label>
  );
}

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={action} className="mt-10 flex flex-col gap-6">
      <input type="hidden" name="next" value={nextPath} />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={8}
      />
      {state?.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="self-start bg-accent px-4 py-2 text-sm text-on-accent transition-colors hover:bg-accent-hover">
        Sign in
      </button>
    </form>
  );
}

export function SignUpForm({ nextPath }: { nextPath?: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(
    signUpAction,
    null,
  );
  const joiningViaInvite = Boolean(nextPath?.startsWith("/invite/"));

  return (
    <form action={action} className="mt-10 flex flex-col gap-6">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <Field label="Your name" name="name" autoComplete="name" />
      <Field label="Work email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />
      {joiningViaInvite ? null : <Field label="Organisation name" name="organisationName" />}
      {state?.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="self-start bg-accent px-4 py-2 text-sm text-on-accent transition-colors hover:bg-accent-hover">
        {joiningViaInvite ? "Create account" : "Create organisation"}
      </button>
    </form>
  );
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { getAuth } from "../auth";
import { readyDatabase } from "../db";
import { session as sessionTable } from "../db/schema";
import { AppError } from "../errors";
import { errorMessage, isNextRedirect } from "../http";
import { ensureWorkspaceForUser } from "../tenant/context";
import { ensureMigrated } from "../tenant/load";

export type AuthActionState = { error: string } | null;

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function toAuthError(error: unknown, fallback: string): AuthActionState {
  if (error instanceof APIError) {
    return { error: error.message || fallback };
  }
  if (error instanceof AppError) {
    return { error: error.message };
  }
  return { error: errorMessage(error, fallback) };
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = readString(formData, "name");
  const email = readString(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const organisationName = readString(formData, "organisationName");
  const nextPath = readString(formData, "next");
  const joiningViaInvite = nextPath.startsWith("/invite/");

  if (name.length < 2) {
    return { error: "Enter your name." };
  }
  if (!email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!joiningViaInvite && organisationName.length < 2) {
    return { error: "Enter an organisation name." };
  }

  try {
    await ensureMigrated();
    const signedUp = await getAuth().api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });

    if (!signedUp.user?.id) {
      return { error: "Could not create your account." };
    }

    if (joiningViaInvite) {
      redirect(nextPath);
    }

    const db = await readyDatabase();
    const workspace = await ensureWorkspaceForUser({
      db,
      userId: signedUp.user.id,
      userName: signedUp.user.name || name,
      organisationName,
    });

    if (!signedUp.token) {
      return {
        error:
          "Account was created but the session could not be established. Sign in to continue.",
      };
    }

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: workspace.organisation.id })
      .where(eq(sessionTable.token, signedUp.token));

    redirect("/employee");
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return toAuthError(error, "Could not create your account.");
  }
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readString(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = readString(formData, "next") || "/employee";

  try {
    await ensureMigrated();
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
    redirect(nextPath.startsWith("/") ? nextPath : "/employee");
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    return toAuthError(error, "Could not sign in. Check your email and password.");
  }
}

export async function signOutAction() {
  await getAuth().api.signOut({
    headers: await headers(),
  });
  redirect("/sign-in");
}

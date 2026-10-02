import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./index";
import { UnauthenticatedError } from "../errors";

export async function getSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

export async function requireSessionOrRedirect(callbackPath = "/employee") {
  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(callbackPath)}`);
  }
  return session;
}

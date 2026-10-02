import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readyDatabase } from "../db";
import { migrateDatabase } from "../db/migrate";
import { getAuth } from "../auth";
import { requireSessionOrRedirect } from "../auth/session";
import { voxaRuntime } from "../runtime";
import { resolveTenantContext, type TenantContext } from "./context";

type MigrateRuntime = {
  migrate?: Promise<void>;
};

export async function ensureMigrated(): Promise<void> {
  const runtime = voxaRuntime() as MigrateRuntime;
  if (!runtime.migrate) {
    runtime.migrate = migrateDatabase().catch((error: unknown) => {
      runtime.migrate = undefined;
      throw error;
    });
  }
  await runtime.migrate;
}

export async function loadTenantContext(): Promise<TenantContext> {
  await ensureMigrated();
  const session = await requireSessionOrRedirect();
  const db = await readyDatabase();

  return resolveTenantContext({
    db,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    activeOrganisationId: session.session.activeOrganizationId,
  });
}

export async function setActiveOrganisation(organisationId: string) {
  try {
    await getAuth().api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: organisationId },
    });
  } catch {
    // Tenant resolution falls back to the user's first membership.
  }
}

export async function redirectIfAuthenticated(to = "/employee") {
  await ensureMigrated();
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect(to);
  }
}

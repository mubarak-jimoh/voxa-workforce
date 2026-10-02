import { createPgliteDatabase, type AppDb, type DatabaseHandle } from "@/platform/db";
import { migrateDatabase } from "@/platform/db/migrate";
import { user } from "@/platform/db/schema";
import { createOrganisationWithOwner } from "@/platform/organisation/commands";
import { provisionOrganisationEmployee } from "@/platform/employee/commands";
import { DEFAULT_EMPLOYEE_NAME } from "@/platform/employee/constants";
import type { WorkScope } from "@/platform/work/scope";

export async function createTestDatabase(): Promise<{
  db: AppDb;
  handle: DatabaseHandle;
}> {
  const handle = createPgliteDatabase();
  await migrateDatabase(handle);
  return { db: handle.db, handle };
}

export async function createTestUser(
  db: AppDb,
  input?: { name?: string; email?: string },
) {
  const now = new Date();
  const record = {
    id: crypto.randomUUID(),
    name: input?.name ?? "Jordan Ellis",
    email: input?.email ?? `jordan-${crypto.randomUUID()}@example.com`,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(user).values(record);
  return record;
}

export async function createTestWorkspace(
  db: AppDb,
  input?: { organisationName?: string; userName?: string; email?: string },
) {
  const owner = await createTestUser(db, {
    name: input?.userName,
    email: input?.email,
  });
  const organisation = await createOrganisationWithOwner(db, {
    name: input?.organisationName ?? "Northridge Interiors",
    ownerUserId: owner.id,
  });
  const employee = await provisionOrganisationEmployee(db, {
    organisationId: organisation.id,
  });

  return { owner, organisation, employee };
}

export function workScopeFor(
  db: AppDb,
  workspace: Awaited<ReturnType<typeof createTestWorkspace>>,
): WorkScope {
  return {
    db,
    organisationId: workspace.organisation.id,
    employeeId: workspace.employee.id,
  };
}

export { DEFAULT_EMPLOYEE_NAME };

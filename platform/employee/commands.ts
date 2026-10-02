import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db";
import { employee } from "../db/schema";
import { ForbiddenError, InvalidTransitionError, NotFoundError } from "../errors";
import { canPauseEmployee } from "../membership/permissions";
import {
  DEFAULT_EMPLOYEE_NAME,
  EMPLOYEE_ROLE_TYPES,
  type EmployeeRoleType,
  type EmployeeStatus,
  type MembershipRole,
} from "./constants";

const STATUS_TRANSITIONS: Record<EmployeeStatus, readonly EmployeeStatus[]> = {
  idle: ["paused"],
  paused: ["idle"],
  offline: [],
};

export type EmployeeRecord = typeof employee.$inferSelect;

export async function listEmployeesForOrganisation(
  db: AppDb,
  organisationId: string,
): Promise<EmployeeRecord[]> {
  return db
    .select()
    .from(employee)
    .where(eq(employee.organisationId, organisationId));
}

export async function getEmployeeByIdForOrganisation(
  db: AppDb,
  organisationId: string,
  employeeId: string,
): Promise<EmployeeRecord | null> {
  const rows = await db
    .select()
    .from(employee)
    .where(
      and(
        eq(employee.id, employeeId),
        eq(employee.organisationId, organisationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function requireEmployeeByIdForOrganisation(
  db: AppDb,
  organisationId: string,
  employeeId: string,
): Promise<EmployeeRecord> {
  const found = await getEmployeeByIdForOrganisation(
    db,
    organisationId,
    employeeId,
  );
  if (!found) {
    throw new NotFoundError("Employee not found.");
  }
  return found;
}

export async function getOrganisationEmployee(
  db: AppDb,
  organisationId: string,
): Promise<EmployeeRecord | null> {
  const rows = await listEmployeesForOrganisation(db, organisationId);
  return rows[0] ?? null;
}

export async function provisionOrganisationEmployee(
  db: AppDb,
  input: {
    organisationId: string;
    name?: string;
    roleType?: EmployeeRoleType;
  },
): Promise<EmployeeRecord> {
  const existing = await listEmployeesForOrganisation(db, input.organisationId);
  if (existing.length > 0) {
    const first = existing[0];
    if (!first) {
      throw new Error("Employee list was non-empty but the first row was missing.");
    }
    return first;
  }

  const now = new Date();
  const roleType = input.roleType ?? EMPLOYEE_ROLE_TYPES[0];
  const created = {
    id: crypto.randomUUID(),
    organisationId: input.organisationId,
    name: input.name?.trim() || DEFAULT_EMPLOYEE_NAME,
    roleType,
    status: "idle" as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(employee).values(created);
  return created;
}

export async function setEmployeeStatus(input: {
  db: AppDb;
  organisationId: string;
  employeeId: string;
  actorRole: MembershipRole;
  nextStatus: EmployeeStatus;
}): Promise<EmployeeRecord> {
  if (!canPauseEmployee(input.actorRole)) {
    throw new ForbiddenError("You cannot pause or resume this employee.");
  }

  const current = await requireEmployeeByIdForOrganisation(
    input.db,
    input.organisationId,
    input.employeeId,
  );

  if (current.status === input.nextStatus) {
    return current;
  }

  const allowed = STATUS_TRANSITIONS[current.status];
  if (!allowed.includes(input.nextStatus)) {
    throw new InvalidTransitionError(
      `Cannot change employee status from ${current.status} to ${input.nextStatus}.`,
    );
  }

  const updatedAt = new Date();
  await input.db
    .update(employee)
    .set({ status: input.nextStatus, updatedAt })
    .where(
      and(
        eq(employee.id, current.id),
        eq(employee.organisationId, input.organisationId),
      ),
    );

  return { ...current, status: input.nextStatus, updatedAt };
}

export async function toggleEmployeePaused(input: {
  db: AppDb;
  organisationId: string;
  employeeId: string;
  actorRole: MembershipRole;
}): Promise<EmployeeRecord> {
  const current = await requireEmployeeByIdForOrganisation(
    input.db,
    input.organisationId,
    input.employeeId,
  );

  const nextStatus: EmployeeStatus =
    current.status === "paused" ? "idle" : "paused";

  return setEmployeeStatus({ ...input, nextStatus });
}

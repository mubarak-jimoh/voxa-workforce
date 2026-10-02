import { provisionOrganisationEmployee } from "../employee/commands";
import type { EmployeeRecord } from "../employee/commands";
import type { MembershipRole } from "../employee/constants";
import { isMembershipRole } from "../employee/constants";
import { UnauthenticatedError, ForbiddenError, NotFoundError } from "../errors";
import type { AppDb } from "../db";
import {
  createOrganisationWithOwner,
  getMembership,
  getOrganisationById,
  listMembershipsForUser,
  type OrganisationRecord,
} from "../organisation/commands";

export type TenantContext = {
  userId: string;
  userName: string;
  userEmail: string;
  organisation: OrganisationRecord;
  membershipRole: MembershipRole;
  employee: EmployeeRecord;
};

export async function ensureWorkspaceForUser(input: {
  db: AppDb;
  userId: string;
  userName: string;
  organisationName?: string;
}): Promise<{ organisation: OrganisationRecord; employee: EmployeeRecord }> {
  const memberships = await listMembershipsForUser(input.db, input.userId);
  const firstMembership = memberships[0];

  if (firstMembership) {
    const organisation = await getOrganisationById(
      input.db,
      firstMembership.organizationId,
    );
    if (!organisation) {
      throw new NotFoundError("Organisation not found.");
    }
    const employee = await provisionOrganisationEmployee(input.db, {
      organisationId: organisation.id,
    });
    return { organisation, employee };
  }

  const organisation = await createOrganisationWithOwner(input.db, {
    name: input.organisationName?.trim() || `${input.userName}'s organisation`,
    ownerUserId: input.userId,
  });
  const employee = await provisionOrganisationEmployee(input.db, {
    organisationId: organisation.id,
  });
  return { organisation, employee };
}

export async function resolveTenantContext(input: {
  db: AppDb;
  userId: string;
  userName: string;
  userEmail: string;
  activeOrganisationId?: string | null;
}): Promise<TenantContext> {
  if (!input.userId) {
    throw new UnauthenticatedError();
  }

  const ensured = await ensureWorkspaceForUser({
    db: input.db,
    userId: input.userId,
    userName: input.userName,
  });

  const organisationId =
    input.activeOrganisationId &&
    (await getMembership(input.db, input.activeOrganisationId, input.userId))
      ? input.activeOrganisationId
      : ensured.organisation.id;

  const organisation = await getOrganisationById(input.db, organisationId);
  if (!organisation) {
    throw new NotFoundError("Organisation not found.");
  }

  const membership = await getMembership(input.db, organisation.id, input.userId);
  if (!membership) {
    throw new ForbiddenError("You are not a member of this organisation.");
  }
  if (!isMembershipRole(membership.role)) {
    throw new ForbiddenError("Invalid membership role.");
  }

  const employee = await provisionOrganisationEmployee(input.db, {
    organisationId: organisation.id,
  });

  return {
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    organisation,
    membershipRole: membership.role,
    employee,
  };
}

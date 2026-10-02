import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { member } from "@/platform/db/schema";
import {
  getEmployeeByIdForOrganisation,
  listEmployeesForOrganisation,
} from "@/platform/employee/commands";
import { createInvitation, acceptInvitation } from "@/platform/organisation/invitations";
import { ForbiddenError } from "@/platform/errors";
import {
  createTestDatabase,
  createTestUser,
  createTestWorkspace,
} from "./helpers";

describe("tenant isolation", () => {
  it("does not return another organisation's employee by id", async () => {
    const { db } = await createTestDatabase();
    const orgA = await createTestWorkspace(db, {
      organisationName: "Oak & Wool",
      email: "a@example.com",
    });
    const orgB = await createTestWorkspace(db, {
      organisationName: "Lime Street Joinery",
      email: "b@example.com",
    });

    const leaked = await getEmployeeByIdForOrganisation(
      db,
      orgA.organisation.id,
      orgB.employee.id,
    );
    expect(leaked).toBeNull();

    const own = await getEmployeeByIdForOrganisation(
      db,
      orgA.organisation.id,
      orgA.employee.id,
    );
    expect(own?.id).toBe(orgA.employee.id);

    const orgAEmployees = await listEmployeesForOrganisation(
      db,
      orgA.organisation.id,
    );
    expect(orgAEmployees.map((row) => row.id)).toEqual([orgA.employee.id]);
  });

  it("accepts an invitation only for the invited email and does not mix employees", async () => {
    const { db } = await createTestDatabase();
    const host = await createTestWorkspace(db, {
      organisationName: "Host Co",
      email: "owner@host.test",
    });
    const guest = await createTestUser(db, {
      name: "Guest",
      email: "guest@example.com",
    });

    const invite = await createInvitation({
      db,
      organisationId: host.organisation.id,
      email: guest.email,
      role: "member",
      inviterId: host.owner.id,
      actorRole: "owner",
    });

    await expect(
      acceptInvitation({
        db,
        invitationId: invite.id,
        userId: guest.id,
        userEmail: "someone-else@example.com",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const accepted = await acceptInvitation({
      db,
      invitationId: invite.id,
      userId: guest.id,
      userEmail: guest.email,
    });
    expect(accepted.organisationId).toBe(host.organisation.id);
    expect(accepted.role).toBe("member");

    const memberships = await db
      .select()
      .from(member)
      .where(eq(member.userId, guest.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.organizationId).toBe(host.organisation.id);

    const employees = await listEmployeesForOrganisation(
      db,
      host.organisation.id,
    );
    expect(employees).toHaveLength(1);
    expect(employees[0]?.id).toBe(host.employee.id);
  });
});

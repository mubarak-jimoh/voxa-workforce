import { describe, expect, it } from "vitest";
import {
  canInviteMembers,
  canPauseEmployee,
  canUpdateOrganisation,
  canViewEmployee,
  canCommandEmployee,
  canDecideApproval,
} from "@/platform/membership/permissions";
import { createInvitation, acceptInvitation } from "@/platform/organisation/invitations";
import { renameOrganisation } from "@/platform/organisation/commands";
import { ForbiddenError } from "@/platform/errors";
import { createTestDatabase, createTestUser, createTestWorkspace } from "./helpers";

describe("membership permissions", () => {
  it("maps owner, admin and member capabilities", () => {
    expect(canViewEmployee("member")).toBe(true);
    expect(canCommandEmployee("member")).toBe(true);
    expect(canDecideApproval("member")).toBe(false);
    expect(canPauseEmployee("member")).toBe(false);
    expect(canInviteMembers("member")).toBe(false);
    expect(canUpdateOrganisation("member")).toBe(false);

    expect(canPauseEmployee("admin")).toBe(true);
    expect(canDecideApproval("admin")).toBe(true);
    expect(canInviteMembers("admin")).toBe(true);
    expect(canUpdateOrganisation("admin")).toBe(false);

    expect(canPauseEmployee("owner")).toBe(true);
    expect(canInviteMembers("owner")).toBe(true);
    expect(canUpdateOrganisation("owner")).toBe(true);
  });

  it("prevents members from inviting or renaming", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);

    await expect(
      createInvitation({
        db,
        organisationId: workspace.organisation.id,
        email: "new@example.com",
        role: "member",
        inviterId: workspace.owner.id,
        actorRole: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      renameOrganisation({
        db,
        organisationId: workspace.organisation.id,
        name: "Renamed Ltd",
        actorRole: "member",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an owner invite an admin who can then join", async () => {
    const { db } = await createTestDatabase();
    const workspace = await createTestWorkspace(db);
    const adminUser = await createTestUser(db, {
      name: "Priya",
      email: "priya@example.com",
    });

    const invite = await createInvitation({
      db,
      organisationId: workspace.organisation.id,
      email: adminUser.email,
      role: "admin",
      inviterId: workspace.owner.id,
      actorRole: "owner",
    });

    const accepted = await acceptInvitation({
      db,
      invitationId: invite.id,
      userId: adminUser.id,
      userEmail: adminUser.email,
    });
    expect(accepted.role).toBe("admin");
  });
});

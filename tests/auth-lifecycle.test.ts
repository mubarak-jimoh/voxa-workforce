import { eq } from "drizzle-orm";
import { createLocalAccountIssuer } from "better-auth/db";
import { describe, expect, it } from "vitest";
import { createAuth } from "@/platform/auth/create";
import { account, session as sessionTable } from "@/platform/db/schema";
import { DEFAULT_EMPLOYEE_NAME } from "@/platform/employee/constants";
import { listEmployeesForOrganisation } from "@/platform/employee/commands";
import { ensureWorkspaceForUser } from "@/platform/tenant/context";
import { acceptInvitation, createInvitation } from "@/platform/organisation/invitations";
import { listMembershipsForUser } from "@/platform/organisation/commands";
import { organisation } from "@/platform/db/schema";
import { createTestDatabase } from "./helpers";

function cookiesFromResponse(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  return setCookies
    .filter(Boolean)
    .map((entry) => entry.split(";")[0] ?? "")
    .join("; ");
}

describe("Better Auth lifecycle", () => {
  it("signs up, provisions one Lead Handler, signs in, and signs out", async () => {
    const { db } = await createTestDatabase();
    const auth = createAuth(db, { withNextCookies: false });

    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name: "Jordan Ellis",
        email: "jordan@northridge.test",
        password: "testpass123",
      },
      asResponse: true,
    });
    expect(signUpResponse.ok).toBe(true);
    const signedUp = (await signUpResponse.json()) as {
      user: { id: string; email: string; name: string };
      token: string;
    };
    const signUpCookies = cookiesFromResponse(signUpResponse);

    expect(signedUp.user.email).toBe("jordan@northridge.test");
    expect(signedUp.token).toBeTruthy();

    const accounts = await db.select().from(account);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.issuer).toBe(createLocalAccountIssuer("credential"));
    expect(accounts[0]?.providerId).toBe("credential");
    expect(accounts[0]?.userId).toBe(signedUp.user.id);

    const sessionsAfterSignUp = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, signedUp.user.id));
    expect(sessionsAfterSignUp).toHaveLength(1);
    expect(sessionsAfterSignUp[0]?.token).toBe(signedUp.token);

    const sessionAfterSignUp = await auth.api.getSession({
      headers: new Headers({ cookie: signUpCookies }),
    });
    expect(sessionAfterSignUp?.user.id).toBe(signedUp.user.id);

    const workspace = await ensureWorkspaceForUser({
      db,
      userId: signedUp.user.id,
      userName: signedUp.user.name,
      organisationName: "Northridge Interiors",
    });
    expect(workspace.organisation.name).toBe("Northridge Interiors");
    expect(workspace.employee.name).toBe(DEFAULT_EMPLOYEE_NAME);
    expect(workspace.employee.roleType).toBe("lead_handler");
    expect(workspace.employee.status).toBe("idle");
    expect(
      await listEmployeesForOrganisation(db, workspace.organisation.id),
    ).toHaveLength(1);

    await auth.api.signOut({
      headers: new Headers({ cookie: signUpCookies }),
    });
    expect(
      await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, signedUp.user.id)),
    ).toHaveLength(0);

    const signInResponse = await auth.api.signInEmail({
      body: {
        email: "jordan@northridge.test",
        password: "testpass123",
      },
      asResponse: true,
    });
    expect(signInResponse.ok).toBe(true);
    const signedIn = (await signInResponse.json()) as {
      user: { id: string };
      token: string;
    };
    expect(signedIn.user.id).toBe(signedUp.user.id);

    const sessionAfterSignIn = await auth.api.getSession({
      headers: new Headers({ cookie: cookiesFromResponse(signInResponse) }),
    });
    expect(sessionAfterSignIn?.user.id).toBe(signedUp.user.id);

    await auth.api.signOut({
      headers: new Headers({ cookie: cookiesFromResponse(signInResponse) }),
    });
    expect(
      await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, signedUp.user.id)),
    ).toHaveLength(0);

    const guest = await auth.api.signUpEmail({
      body: {
        name: "Priya Shah",
        email: "priya@example.com",
        password: "testpass123",
      },
    });
    const invite = await createInvitation({
      db,
      organisationId: workspace.organisation.id,
      email: guest.user.email,
      role: "member",
      inviterId: signedUp.user.id,
      actorRole: "owner",
    });
    const accepted = await acceptInvitation({
      db,
      invitationId: invite.id,
      userId: guest.user.id,
      userEmail: guest.user.email,
    });
    expect(accepted.organisationId).toBe(workspace.organisation.id);
    expect(accepted.role).toBe("member");
    expect(
      await listEmployeesForOrganisation(db, workspace.organisation.id),
    ).toHaveLength(1);
  });

  it("provisions the named organisation from the signup result, not a cookie re-read", async () => {
    const { db } = await createTestDatabase();
    const auth = createAuth(db, { withNextCookies: false });

    const signedUp = await auth.api.signUpEmail({
      body: {
        name: "Alex Rivera",
        email: "alex@northstar.test",
        password: "testpass123",
      },
    });

    expect(signedUp.user.id).toBeTruthy();
    expect(signedUp.token).toBeTruthy();
    if (!signedUp.token) {
      throw new Error("signup did not return a session token");
    }

    const sessionFromIncomingHeaders = await auth.api.getSession({
      headers: new Headers(),
    });
    expect(sessionFromIncomingHeaders).toBeNull();

    const workspace = await ensureWorkspaceForUser({
      db,
      userId: signedUp.user.id,
      userName: signedUp.user.name,
      organisationName: "Northstar Test Company",
    });

    expect(workspace.organisation.name).toBe("Northstar Test Company");
    expect(workspace.employee.name).toBe(DEFAULT_EMPLOYEE_NAME);
    expect(workspace.employee.roleType).toBe("lead_handler");
    expect(workspace.employee.status).toBe("idle");

    await db
      .update(sessionTable)
      .set({ activeOrganizationId: workspace.organisation.id })
      .where(eq(sessionTable.token, signedUp.token));

    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, signedUp.user.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.activeOrganizationId).toBe(workspace.organisation.id);

    const again = await ensureWorkspaceForUser({
      db,
      userId: signedUp.user.id,
      userName: signedUp.user.name,
    });
    expect(again.organisation.id).toBe(workspace.organisation.id);
    expect(again.organisation.name).toBe("Northstar Test Company");
    expect(again.employee.id).toBe(workspace.employee.id);

    expect(await listMembershipsForUser(db, signedUp.user.id)).toHaveLength(1);
    expect(await db.select().from(organisation)).toHaveLength(1);
    expect(
      await listEmployeesForOrganisation(db, workspace.organisation.id),
    ).toHaveLength(1);
  });
});

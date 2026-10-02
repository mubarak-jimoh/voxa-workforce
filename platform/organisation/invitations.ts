import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db";
import { invitation, member } from "../db/schema";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";
import type { MembershipRole } from "../employee/constants";
import { canInviteMembers } from "../membership/permissions";
import { getMembership, parseMembershipRole } from "./commands";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InvitationRecord = typeof invitation.$inferSelect;

export async function listPendingInvitations(
  db: AppDb,
  organisationId: string,
): Promise<InvitationRecord[]> {
  return db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organisationId),
        eq(invitation.status, "pending"),
      ),
    );
}

export async function createInvitation(input: {
  db: AppDb;
  organisationId: string;
  email: string;
  role: string;
  inviterId: string;
  actorRole: MembershipRole;
}): Promise<InvitationRecord> {
  if (!canInviteMembers(input.actorRole)) {
    throw new ForbiddenError("You cannot invite members.");
  }

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Enter a valid email address.");
  }

  const role = parseMembershipRole(input.role);
  if (role === "owner") {
    throw new ValidationError("Owner cannot be assigned by invitation.");
  }

  const now = new Date();
  const created: InvitationRecord = {
    id: crypto.randomUUID(),
    organizationId: input.organisationId,
    email,
    role,
    status: "pending",
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    createdAt: now,
    inviterId: input.inviterId,
  };

  await input.db.insert(invitation).values(created);
  return created;
}

export async function getInvitationById(
  db: AppDb,
  invitationId: string,
): Promise<InvitationRecord | null> {
  const rows = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function acceptInvitation(input: {
  db: AppDb;
  invitationId: string;
  userId: string;
  userEmail: string;
}): Promise<{ organisationId: string; role: MembershipRole }> {
  const invite = await getInvitationById(input.db, input.invitationId);
  if (!invite) {
    throw new NotFoundError("Invitation not found.");
  }

  if (invite.status !== "pending") {
    throw new ConflictError("This invitation is no longer pending.");
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new ConflictError("This invitation has expired.");
  }

  if (invite.email.toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    throw new ForbiddenError(
      "This invitation was sent to a different email address.",
    );
  }

  const existing = await getMembership(
    input.db,
    invite.organizationId,
    input.userId,
  );
  if (existing) {
    await input.db
      .update(invitation)
      .set({ status: "accepted" })
      .where(eq(invitation.id, invite.id));
    return {
      organisationId: invite.organizationId,
      role: parseMembershipRole(existing.role),
    };
  }

  const role = parseMembershipRole(invite.role);
  await input.db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: invite.organizationId,
    userId: input.userId,
    role,
    createdAt: new Date(),
  });
  await input.db
    .update(invitation)
    .set({ status: "accepted" })
    .where(eq(invitation.id, invite.id));

  return { organisationId: invite.organizationId, role };
}

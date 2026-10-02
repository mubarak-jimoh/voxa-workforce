import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db";
import { member, organisation, user } from "../db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import {
  isMembershipRole,
  type MembershipRole,
} from "../employee/constants";
import { canUpdateOrganisation } from "../membership/permissions";

export type OrganisationRecord = typeof organisation.$inferSelect;
export type MemberRecord = typeof member.$inferSelect;

export async function getOrganisationById(
  db: AppDb,
  organisationId: string,
): Promise<OrganisationRecord | null> {
  const rows = await db
    .select()
    .from(organisation)
    .where(eq(organisation.id, organisationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMembership(
  db: AppDb,
  organisationId: string,
  userId: string,
): Promise<MemberRecord | null> {
  const rows = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, organisationId), eq(member.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listMembershipsForUser(db: AppDb, userId: string) {
  return db.select().from(member).where(eq(member.userId, userId));
}

export async function listOrganisationMembers(db: AppDb, organisationId: string) {
  return db
    .select({
      membershipId: member.id,
      role: member.role,
      createdAt: member.createdAt,
      userId: user.id,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organisationId));
}

export function slugifyOrganisationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug.length > 0 ? slug : "organisation";
}

export async function allocateOrganisationSlug(
  db: AppDb,
  name: string,
): Promise<string> {
  const base = slugifyOrganisationName(name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${crypto.randomUUID().slice(0, 6)}`;
    const candidate = `${base}${suffix}`;
    const existing = await db
      .select({ id: organisation.id })
      .from(organisation)
      .where(eq(organisation.slug, candidate))
      .limit(1);
    if (existing.length === 0) {
      return candidate;
    }
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createOrganisationWithOwner(
  db: AppDb,
  input: { name: string; ownerUserId: string },
): Promise<OrganisationRecord> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new ValidationError("Organisation name must be at least 2 characters.");
  }

  const now = new Date();
  const created: OrganisationRecord = {
    id: crypto.randomUUID(),
    name,
    slug: await allocateOrganisationSlug(db, name),
    logo: null,
    createdAt: now,
    updatedAt: now,
    metadata: null,
    timezone: "Europe/London",
  };

  await db.insert(organisation).values(created);
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: created.id,
    userId: input.ownerUserId,
    role: "owner",
    createdAt: now,
  });

  return created;
}

export async function renameOrganisation(input: {
  db: AppDb;
  organisationId: string;
  name: string;
  actorRole: MembershipRole;
}): Promise<OrganisationRecord> {
  if (!canUpdateOrganisation(input.actorRole)) {
    throw new ForbiddenError("Only the owner can rename the organisation.");
  }

  const name = input.name.trim();
  if (name.length < 2) {
    throw new ValidationError("Organisation name must be at least 2 characters.");
  }

  const current = await getOrganisationById(input.db, input.organisationId);
  if (!current) {
    throw new NotFoundError("Organisation not found.");
  }

  const updatedAt = new Date();
  await input.db
    .update(organisation)
    .set({ name, updatedAt })
    .where(eq(organisation.id, input.organisationId));

  return { ...current, name, updatedAt };
}

export function parseMembershipRole(role: string): MembershipRole {
  if (!isMembershipRole(role)) {
    throw new ValidationError("Invalid membership role.");
  }
  return role;
}

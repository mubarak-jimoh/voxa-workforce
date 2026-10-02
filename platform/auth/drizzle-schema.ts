import { schema } from "../db/schema";

/**
 * Tables passed to Better Auth's Drizzle adapter.
 * Keys must match Better Auth model names (`organization`, not `organisation`).
 */
export const betterAuthDrizzleSchema = {
  user: schema.user,
  session: schema.session,
  account: schema.account,
  verification: schema.verification,
  organization: schema.organisation,
  member: schema.member,
  invitation: schema.invitation,
};

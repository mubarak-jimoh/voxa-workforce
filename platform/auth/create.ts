import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import type { AppDb } from "../db";
import { readEnv } from "../env";
import { betterAuthDrizzleSchema } from "./drizzle-schema";

export function createAuth(
  db: AppDb,
  options?: { withNextCookies?: boolean },
) {
  const env = readEnv();
  const withNextCookies = options?.withNextCookies ?? true;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthDrizzleSchema,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 1,
        sendInvitationEmail: async () => {
          // Phase 1: invitations are shared as a copyable link. No email provider.
        },
      }),
      ...(withNextCookies ? [nextCookies()] : []),
    ],
  });
}

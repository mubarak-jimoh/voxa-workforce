import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getAuthTables, createLocalAccountIssuer } from "better-auth/db";
import { organization } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import {
  account,
  member,
  organisation,
  invitation,
  session,
  user,
  verification,
} from "@/platform/db/schema";
import { betterAuthDrizzleSchema } from "@/platform/auth/drizzle-schema";

const betterAuthTables = getAuthTables({
  emailAndPassword: { enabled: true },
  plugins: [organization()],
});

const drizzleTables = {
  user,
  session,
  account,
  verification,
  organization: organisation,
  member,
  invitation,
} as const;

describe("Better Auth Drizzle schema compatibility", () => {
  it("exposes every Better Auth field on the matching Drizzle table", () => {
    for (const [modelName, table] of Object.entries(betterAuthTables)) {
      const drizzleTable = drizzleTables[modelName as keyof typeof drizzleTables];
      expect(drizzleTable, `missing Drizzle table for ${modelName}`).toBeDefined();
      const columns = getTableColumns(drizzleTable);
      for (const fieldName of Object.keys(table.fields)) {
        expect(
          columns,
          `${modelName} is missing Better Auth field "${fieldName}"`,
        ).toHaveProperty(fieldName);
      }
    }
  });

  it("keys credential accounts on issuer + accountId", () => {
    expect(createLocalAccountIssuer("credential")).toBe("local:credential");

    const indexes = getTableConfig(account).indexes;
    const identityIndex = indexes.find(
      (index) => index.config.name === "account_issuer_account_id_uidx",
    );

    expect(identityIndex?.config.unique).toBe(true);
  });

  it("passes the same table map Better Auth uses at runtime", () => {
    expect(betterAuthDrizzleSchema.account).toBe(account);
    expect(betterAuthDrizzleSchema.organization).toBe(organisation);
    expect(getTableColumns(betterAuthDrizzleSchema.account)).toHaveProperty("issuer");
  });
});

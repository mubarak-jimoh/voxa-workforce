import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import {
  getDatabaseHandle,
  type DatabaseHandle,
  readyDatabase,
} from "./index";

export function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

export async function migrateDatabase(
  handle?: DatabaseHandle,
): Promise<void> {
  const resolved = handle ?? getDatabaseHandle();
  await readyDatabase(resolved);
  const folder = migrationsFolder();

  if (resolved.kind === "pglite") {
    await migratePglite(resolved.db, { migrationsFolder: folder });
    return;
  }

  await migratePostgres(resolved.db, { migrationsFolder: folder });
}

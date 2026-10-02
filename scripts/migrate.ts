import { config } from "dotenv";
import { closeDatabaseHandle, getDatabaseHandle } from "../platform/db";
import { migrateDatabase } from "../platform/db/migrate";

config({ path: ".env.local" });
config({ path: ".env" });

const handle = getDatabaseHandle();

migrateDatabase(handle)
  .then(async () => {
    await closeDatabaseHandle(handle);
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    try {
      await closeDatabaseHandle(handle);
    } catch {
      // Closing is best-effort so the original error remains visible.
    }
    process.exit(1);
  });

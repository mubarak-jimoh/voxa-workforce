import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  closeDatabaseHandle,
  createPgliteDatabase,
  readyDatabase,
} from "@/platform/db";
import { migrateDatabase } from "@/platform/db/migrate";
import { pgliteLockPath } from "@/platform/db/pglite-lock";
import { user } from "@/platform/db/schema";

const tmpDirs: string[] = [];

function tempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voxa-pglite-data-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(pgliteLockPath(dir), { force: true });
    for (const extra of fs.readdirSync(path.dirname(dir))) {
      if (extra.startsWith(`${path.basename(dir)}.corrupt-`)) {
        fs.rmSync(path.join(path.dirname(dir), extra), {
          recursive: true,
          force: true,
        });
      }
    }
  }
});

describe("file-backed PGlite lifecycle", () => {
  it("closes cleanly and reopens the same data directory", async () => {
    const dir = tempDataDir();
    const first = createPgliteDatabase(dir);
    await migrateDatabase(first);
    await first.db.insert(user).values({
      id: "user-1",
      name: "Jordan Ellis",
      email: "jordan@northridge.test",
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await closeDatabaseHandle(first);

    expect(fs.existsSync(path.join(dir, "postmaster.pid"))).toBe(false);

    const second = createPgliteDatabase(dir);
    await readyDatabase(second);
    const rows = await second.db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("jordan@northridge.test");
    await closeDatabaseHandle(second);
  });

  it("does not open a second PGlite against the same data directory", async () => {
    const dir = tempDataDir();
    const first = createPgliteDatabase(dir);
    await readyDatabase(first);
    expect(() => createPgliteDatabase(dir)).toThrow(/already open in this process/);
    await closeDatabaseHandle(first);
  });

  it("recovers from a corrupt data directory instead of aborting WASM", async () => {
    const dir = tempDataDir();
    const first = createPgliteDatabase(dir);
    await migrateDatabase(first);
    await closeDatabaseHandle(first);

    fs.writeFileSync(path.join(dir, "global/pg_control"), "not-a-postgres-control-file");

    const recovered = createPgliteDatabase(dir);
    await migrateDatabase(recovered);
    const rows = await recovered.db.select().from(user);
    expect(rows).toHaveLength(0);
    const backups = fs
      .readdirSync(path.dirname(dir))
      .filter((name) => name.startsWith(`${path.basename(dir)}.corrupt-`));
    expect(backups.length).toBeGreaterThan(0);
    await closeDatabaseHandle(recovered);
  });
});

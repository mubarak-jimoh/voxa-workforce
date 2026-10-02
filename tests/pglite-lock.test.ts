import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseHandle } from "@/platform/db";
import {
  acquirePgliteLock,
  isProcessAlive,
  pgliteLockPath,
} from "@/platform/db/pglite-lock";

const tmpDirs: string[] = [];

function tempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voxa-pglite-lock-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(pgliteLockPath(dir), { force: true });
  }
});

describe("PGlite data directory lock", () => {
  it("treats pid 1 as alive and a huge unused pid as dead", () => {
    expect(isProcessAlive(1)).toBe(true);
    expect(isProcessAlive(-42)).toBe(false);
    expect(isProcessAlive(999_999_999)).toBe(false);
  });

  it("refuses a second acquire in the same process", () => {
    const dir = tempDataDir();
    const release = acquirePgliteLock(dir);
    expect(() => acquirePgliteLock(dir)).toThrow(/already open in this process/);
    release();
  });

  it("refuses a lock held by another live process", () => {
    const dir = tempDataDir();
    fs.writeFileSync(pgliteLockPath(dir), "1\n");
    expect(() => acquirePgliteLock(dir)).toThrow(/already in use by pid 1/);
  });

  it("reclaims a stale lock from a dead process", () => {
    const dir = tempDataDir();
    fs.writeFileSync(pgliteLockPath(dir), "999999999\n");
    const release = acquirePgliteLock(dir);
    expect(fs.readFileSync(pgliteLockPath(dir), "utf8")).toContain(String(process.pid));
    release();
    expect(fs.existsSync(pgliteLockPath(dir))).toBe(false);
  });

  it("does not open file-backed PGlite during next build", () => {
    const previous = process.env.NEXT_PHASE;
    process.env.NEXT_PHASE = "phase-production-build";
    try {
      expect(() => getDatabaseHandle()).toThrow(/next build/);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXT_PHASE;
      } else {
        process.env.NEXT_PHASE = previous;
      }
    }
  });
});

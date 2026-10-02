import fs from "node:fs";
import path from "node:path";

export function pgliteLockPath(dataDir: string): string {
  return `${path.resolve(dataDir)}.lock`;
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readLockPid(lockPath: string): number | undefined {
  try {
    const pid = Number.parseInt(fs.readFileSync(lockPath, "utf8").trim().split("\n")[0] ?? "", 10);
    return Number.isInteger(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
}

function writeLockFile(lockPath: string, dataDir: string): void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${process.pid}\n${dataDir}\n`, { flag: "wx" });
}

/**
 * Exclusive owner for a file-backed PGlite data directory. PGlite is single-user:
 * two processes (or two WASM instances) on the same files abort and can corrupt WAL.
 */
export function acquirePgliteLock(dataDir: string): () => void {
  const resolved = path.resolve(dataDir);
  const lockPath = pgliteLockPath(resolved);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      writeLockFile(lockPath, resolved);
      return () => releasePgliteLock(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      const ownerPid = readLockPid(lockPath);
      if (ownerPid === process.pid) {
        throw new Error(
          `PGlite data directory ${resolved} is already open in this process.`,
        );
      }
      if (ownerPid !== undefined && isProcessAlive(ownerPid)) {
        throw new Error(
          `PGlite data directory ${resolved} is already in use by pid ${ownerPid}. Stop that process before starting another.`,
        );
      }

      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Another process won the reclaim race; retry exclusive create.
      }
    }
  }

  throw new Error(`Unable to acquire PGlite lock for ${resolved}`);
}

export function releasePgliteLock(lockPath: string): void {
  try {
    const ownerPid = readLockPid(lockPath);
    if (ownerPid !== undefined && ownerPid !== process.pid && isProcessAlive(ownerPid)) {
      return;
    }
    fs.unlinkSync(lockPath);
  } catch {
    // Lock is already gone.
  }
}

export function clearStalePostmasterPid(dataDir: string): void {
  const pidPath = path.join(path.resolve(dataDir), "postmaster.pid");
  try {
    fs.unlinkSync(pidPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { isNextProductionBuild, readEnv, usesPostgres } from "../env";
import { voxaRuntime } from "../runtime";
import {
  acquirePgliteLock,
  clearStalePostmasterPid,
} from "./pglite-lock";
import * as schema from "./schema";

export type Schema = typeof schema;
export type AppDb =
  | PgliteDatabase<Schema>
  | PostgresJsDatabase<Schema>;

type PgliteHandle = {
  kind: "pglite";
  db: PgliteDatabase<Schema>;
  client: PGlite;
  dataDir?: string;
};

type PostgresHandle = {
  kind: "postgres";
  db: PostgresJsDatabase<Schema>;
  client: ReturnType<typeof postgres>;
};

export type DatabaseHandle = PgliteHandle | PostgresHandle;

type DatabaseRuntime = {
  handle?: DatabaseHandle;
  ready?: Promise<AppDb>;
  shutdownRegistered?: boolean;
};

const lockReleases = new WeakMap<DatabaseHandle, () => void>();

function runtimeState(): DatabaseRuntime {
  return voxaRuntime() as DatabaseRuntime;
}

function openPgliteClient(dataDir?: string): Pick<PgliteHandle, "client" | "db"> {
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  return { client, db };
}

export function createPgliteDatabase(dataDir?: string): PgliteHandle {
  const resolved = dataDir ? path.resolve(dataDir) : undefined;
  const releaseLock = resolved ? acquirePgliteLock(resolved) : undefined;
  if (resolved) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    clearStalePostmasterPid(resolved);
  }

  try {
    const handle: PgliteHandle = {
      kind: "pglite",
      ...openPgliteClient(resolved),
      dataDir: resolved,
    };
    if (releaseLock) {
      lockReleases.set(handle, releaseLock);
    }
    return handle;
  } catch (error) {
    releaseLock?.();
    throw error;
  }
}

export function createPostgresDatabase(url: string): PostgresHandle {
  const client = postgres(url, { max: 1 });
  const db = drizzlePostgres(client, { schema });
  return { kind: "postgres", db, client };
}

export function createDatabaseFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): DatabaseHandle {
  if (usesPostgres(source)) {
    const url = source.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for PostgreSQL");
    }
    return createPostgresDatabase(url);
  }

  const env = readEnvLoose(source);
  return createPgliteDatabase(env.pgliteDataDir);
}

function readEnvLoose(source: NodeJS.ProcessEnv): { pgliteDataDir: string } {
  try {
    const env = readEnv(source);
    return { pgliteDataDir: env.PGLITE_DATA_DIR };
  } catch {
    return { pgliteDataDir: source.PGLITE_DATA_DIR ?? ".data/voxa" };
  }
}

export function getDatabaseHandle(): DatabaseHandle {
  if (isNextProductionBuild() && !usesPostgres()) {
    throw new Error(
      "File-backed PGlite cannot be opened during `next build`. Next.js spawns multiple workers that would corrupt the data directory. The database starts at runtime.",
    );
  }

  const runtime = runtimeState();
  if (!runtime.handle) {
    runtime.handle = createDatabaseFromEnv();
    registerDatabaseShutdown(runtime.handle);
  }
  return runtime.handle;
}

export function getDb(): AppDb {
  return getDatabaseHandle().db;
}

export async function readyDatabase(
  handle: DatabaseHandle = getDatabaseHandle(),
): Promise<AppDb> {
  const runtime = runtimeState();
  if (handle === runtime.handle) {
    if (!runtime.ready) {
      runtime.ready = readyHandle(handle).catch((error: unknown) => {
        runtime.ready = undefined;
        throw error;
      });
    }
    return runtime.ready;
  }

  return readyHandle(handle);
}

export async function closeDatabaseHandle(
  handle: DatabaseHandle = getDatabaseHandle(),
): Promise<void> {
  const runtime = runtimeState();
  try {
    if (handle.kind === "pglite") {
      if (!handle.client.closed) {
        await handle.client.close();
      }
    } else {
      await handle.client.end({ timeout: 5 });
    }
  } finally {
    lockReleases.get(handle)?.();
    lockReleases.delete(handle);
    if (handle === runtime.handle) {
      runtime.handle = undefined;
      runtime.ready = undefined;
      delete voxaRuntime().auth;
    }
  }
}

async function readyHandle(handle: DatabaseHandle): Promise<AppDb> {
  if (handle.kind !== "pglite") {
    return handle.db;
  }

  try {
    await startPglite(handle);
    return handle.db;
  } catch (error) {
    if (!isPgliteAbort(error) || !handle.dataDir) {
      throw wrapPgliteStartError(handle.dataDir, error);
    }
    await recoverPgliteHandle(handle);
    return handle.db;
  }
}

async function startPglite(handle: PgliteHandle): Promise<void> {
  await handle.client.waitReady;
  await handle.client.query("select 1");
}

async function recoverPgliteHandle(handle: PgliteHandle): Promise<void> {
  const dataDir = handle.dataDir;
  if (!dataDir) {
    throw new Error("PGlite recovery requires a data directory");
  }

  try {
    if (!handle.client.closed) {
      await handle.client.close();
    }
  } catch {
    // WASM already aborted; continue with a fresh directory.
  }

  quarantinePgliteDataDir(dataDir);
  clearStalePostmasterPid(dataDir);
  const recovered = openPgliteClient(dataDir);
  handle.client = recovered.client;
  handle.db = recovered.db;
  delete voxaRuntime().auth;

  try {
    await startPglite(handle);
  } catch (error) {
    throw wrapPgliteStartError(dataDir, error);
  }
}

function quarantinePgliteDataDir(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${dataDir}.corrupt-${stamp}`;
  fs.renameSync(dataDir, backup);
  console.warn(
    `PGlite failed to start from ${dataDir} (corrupt or incomplete after an unclean shutdown). Moved it to ${backup} and creating a fresh database.`,
  );
}

function isPgliteAbort(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "RuntimeError" || /Aborted\(\)/.test(error.message);
}

function wrapPgliteStartError(dataDir: string | undefined, error: unknown): Error {
  const location = dataDir ?? "in-memory PGlite";
  return new Error(
    `PGlite failed to start (${location}). The local database files may be corrupt. Delete the data directory and retry.`,
    { cause: error },
  );
}

function registerDatabaseShutdown(handle: DatabaseHandle): void {
  const runtime = runtimeState();
  if (runtime.shutdownRegistered) {
    return;
  }
  runtime.shutdownRegistered = true;
  process.once("beforeExit", () => {
    void closeDatabaseHandle(handle);
  });
  process.once("exit", () => {
    lockReleases.get(handle)?.();
  });
}

export { schema };

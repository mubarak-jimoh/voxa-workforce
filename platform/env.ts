import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default(".data/voxa"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse({
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    DATABASE_URL: source.DATABASE_URL,
    PGLITE_DATA_DIR: source.PGLITE_DATA_DIR,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }

  return parsed.data;
}

export function usesPostgres(source: NodeJS.ProcessEnv = process.env): boolean {
  const url = source.DATABASE_URL;
  return Boolean(url && url.startsWith("postgres"));
}

export function isNextProductionBuild(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return source.NEXT_PHASE === "phase-production-build";
}

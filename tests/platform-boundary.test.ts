import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === ".data" ||
      entry === "drizzle"
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("platform / pack boundary", () => {
  it("does not define Lead Handler domain models", () => {
    const files = walk(ROOT).filter(
      (file) => !file.endsWith("platform-boundary.test.ts"),
    );
    const forbidden = [
      /pgTable\(\s*["']lead["']/,
      /pgTable\(\s*["']quote["']/,
      /pgTable\(\s*["']appointment["']/,
      /export type Lead\b/,
      /export type Quote\b/,
      /export type Appointment\b/,
      /export type FollowUpSequence\b/,
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(source, relative(ROOT, file)).not.toMatch(pattern);
      }
    }
  });

  it("keeps platform free of employee pack imports", () => {
    const platformFiles = walk(join(ROOT, "platform"));
    for (const file of platformFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(ROOT, file)).not.toMatch(
        /from\s+["']@\/employees/,
      );
      expect(source, relative(ROOT, file)).not.toMatch(
        /from\s+["']\.\.\/employees/,
      );
    }
  });

  it("only registers the Lead Handler role in the pack", () => {
    const packFiles = walk(join(ROOT, "employees", "lead-handler"));
    expect(packFiles.length).toBeGreaterThan(0);
    for (const file of packFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/pgTable/);
    }
  });
});

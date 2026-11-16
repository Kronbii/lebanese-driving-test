import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vercel compiles api/ and server/ file by file as native ESM, which needs explicit file
 * extensions. An extensionless relative import passes tests and the build, then crashes the
 * deployed function with ERR_MODULE_NOT_FOUND. Keep every relative import ending in `.js`.
 */
const ROOTS = ["api", "server", "server/routes"];
const SHARED = ["src/api/types.ts", "src/data/questions.ts", "src/domain/types.ts"];
const SPECIFIER = /(?:from\s*|import\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;

function runtimeFiles(): string[] {
  const files = ROOTS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "test-utils.ts")
      .map((name) => join(dir, name))
  );
  return [...files, ...SHARED];
}

describe("API imports", () => {
  it("use explicit .js extensions for relative paths", () => {
    const bad: string[] = [];
    for (const file of runtimeFiles()) {
      for (const match of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
        if (!match[1].endsWith(".js")) bad.push(`${file}: ${match[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

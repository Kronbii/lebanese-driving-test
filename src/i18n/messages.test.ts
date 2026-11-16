import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGES } from "../domain/gamification";
import { MODES } from "../domain/modes";
import { hasKey, translate } from "./core";
import { NAMESPACES } from "./messages";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(tsx?|ts)$/.test(name) && !name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

describe("i18n catalog", () => {
  it("has identical keys in ar, en and fr for every namespace", () => {
    for (const [namespace, messages] of Object.entries(NAMESPACES)) {
      const ar = Object.keys(messages.ar).sort();
      expect(Object.keys(messages.en).sort(), `${namespace}: en vs ar`).toEqual(ar);
      expect(Object.keys(messages.fr).sort(), `${namespace}: fr vs ar`).toEqual(ar);
    }
  });

  it("has no empty strings", () => {
    for (const [namespace, messages] of Object.entries(NAMESPACES)) {
      for (const lang of ["ar", "en", "fr"] as const) {
        for (const [key, value] of Object.entries(messages[lang])) {
          expect(value.trim(), `${lang}:${namespace}.${key}`).not.toBe("");
        }
      }
    }
  });

  it("defines every literal key used in the source", () => {
    const root = join(__dirname, "..");
    const missing: string[] = [];
    const pattern = /\bt\(\s*"([a-z]+\.[A-Za-z0-9_]+)"/g;
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(pattern)) {
        if (!hasKey("ar", match[1])) missing.push(`${match[1]} (${file.replace(root, "src")})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("defines the dynamic trainer keys", () => {
    const keys: string[] = [];
    for (const mode of Object.keys(MODES)) {
      keys.push(`trainer.mode_${mode}`, `trainer.modeDesc_${mode}`, `trainer.emptyMode_${mode}`);
    }
    for (const badge of BADGES) keys.push(`trainer.badge_${badge}`, `trainer.badgeHow_${badge}`);
    for (const label of ["not_ready", "needs_signs", "almost", "ready"]) {
      keys.push(`trainer.readiness_${label}`, `trainer.readinessHint_${label}`);
    }
    for (const factor of ["recentExams", "mastery", "coverage", "signs", "trend", "recency", "timed"]) {
      keys.push(`trainer.factor_${factor}`);
    }
    for (const kind of ["first_exam", "daily_review", "cover_unseen", "fix_mistakes", "signs_drill", "weak_topic", "timed_exam", "keep_sharp"]) {
      keys.push(`trainer.plan_${kind}`, `trainer.planWhy_${kind}`);
    }
    for (const filter of ["open", "repeated", "active", "fixed", "favorites", "notes"]) {
      keys.push(`trainer.notebook_${filter}`, `trainer.notebookEmpty_${filter}`);
    }
    const missing = keys.filter((key) => !hasKey("ar", key) || !hasKey("en", key) || !hasKey("fr", key));
    expect(missing).toEqual([]);
  });

  it("interpolates variables with language digits", () => {
    expect(translate("ar", "trainer.questionOf", { n: 3, total: 30 })).toBe("السؤال ٣ من ٣٠");
    expect(translate("en", "trainer.questionOf", { n: 3, total: 30 })).toBe("Question 3 of 30");
  });
});

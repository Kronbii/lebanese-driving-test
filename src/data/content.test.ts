import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Question } from "../domain/types";
import { CONTENT, loadContent, topicOf } from "./content";
import { QUESTIONS } from "./questions";
import { TOPICS_BY_ID } from "./topics";

const ALL: Question[] = QUESTIONS;
const ARABIC = /[؀-ۿ]/;

describe("official question bank", () => {
  it("has unique ids, 3 options and one valid answer per question", () => {
    expect(new Set(ALL.map((q) => q.id)).size).toBe(ALL.length);
    for (const question of ALL) {
      expect(question.options, `q${question.id}`).toHaveLength(3);
      expect(question.answer, `q${question.id}`).toBeGreaterThanOrEqual(0);
      expect(question.answer, `q${question.id}`).toBeLessThan(3);
      expect(new Set(question.options).size, `q${question.id} duplicate options`).toBe(3);
    }
  });

  it("renders Arabic text (no mojibake) and has every sign image", () => {
    for (const question of ALL) {
      if (question.sign) {
        expect(existsSync(join(__dirname, "../../public", question.sign)), question.sign).toBe(true);
      } else {
        expect(ARABIC.test(question.text), `q${question.id} text`).toBe(true);
      }
      for (const option of question.options) {
        expect(option, `q${question.id}`).not.toMatch(/Ã|Ø§|�/);
      }
    }
  });
});

describe("study content", () => {
  beforeAll(() => loadContent());

  it("covers every question", () => {
    const missing = ALL.filter((question) => !CONTENT.has(question.id)).map((q) => q.id);
    expect(missing).toEqual([]);
  });

  it("is consistent with the official answers", () => {
    for (const question of ALL) {
      const content = CONTENT.get(question.id);
      if (!content) continue;
      const where = `q${question.id}`;
      expect(TOPICS_BY_ID.has(content.topic), `${where} topic ${content.topic}`).toBe(true);
      expect(topicOf(question.id), `${where} topic-map.json is stale: run npm run bank -- manifest`).toBe(content.topic);
      expect(TOPICS_BY_ID.get(content.topic)?.group === "signs", `${where} sign topic`).toBe(Boolean(question.sign));
      for (const lang of ["ar", "en", "fr"] as const) {
        expect(content.explanation[lang]?.trim(), `${where} explanation ${lang}`).toBeTruthy();
        const why = content.whyWrong[lang];
        expect(why, `${where} whyWrong ${lang}`).toHaveLength(3);
        why.forEach((reason, index) => {
          if (index === question.answer) expect(reason, `${where} ${lang} correct slot`).toBeNull();
          else expect(reason?.trim(), `${where} ${lang} slot ${index}`).toBeTruthy();
        });
        if (content.tip) expect(content.tip[lang]?.trim(), `${where} tip ${lang}`).toBeTruthy();
      }
      expect(ARABIC.test(content.explanation.ar), `${where} Arabic explanation`).toBe(true);
      for (const lang of ["en", "fr"] as const) {
        const translation = content.translation[lang];
        expect(translation.options, `${where} ${lang} options`).toHaveLength(3);
        if (question.sign) expect(translation.text, `${where} ${lang} sign text`).toBe("");
        else expect(translation.text.trim(), `${where} ${lang} text`).toBeTruthy();
      }
    }
  });
});

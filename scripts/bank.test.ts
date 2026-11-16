import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../src/data/bank-manifest.json";
import { QUESTIONS } from "../src/data/questions";
import type { Question } from "../src/domain/types";
import { checksum, formatQuestionsFile, questionsFileHeader, validate } from "./bank";

const ALL: Question[] = QUESTIONS;

describe("question bank pipeline", () => {
  it("validates the shipped bank", () => {
    expect(validate(ALL)).toEqual([]);
  });

  it("matches the manifest checksum (run `npm run bank -- manifest` after editing questions)", () => {
    expect(checksum(ALL)).toBe(manifest.checksum);
  });

  it("rewrites questions.ts byte-for-byte", () => {
    const file = readFileSync(join(__dirname, "../src/data/questions.ts"), "utf8");
    expect(formatQuestionsFile(ALL, questionsFileHeader())).toBe(file);
  });

  it("rejects malformed questions", () => {
    const bad: Question[] = [{ id: 1, text: "abc", options: ["a", "a"], answer: 3, sign: null }];
    expect(validate(bad).length).toBeGreaterThanOrEqual(3);
  });
});

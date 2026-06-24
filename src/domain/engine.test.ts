import { describe, expect, it } from "vitest";
import {
  buildExam,
  createProgressState,
  recordAnswer,
  startExam,
  summary,
  weakestIds
} from "./engine";

function predictableRng(): () => number {
  let seed = 123456789;
  return () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("adaptive exam engine", () => {
  it("reserves most of the exam for unseen questions until coverage is complete", () => {
    const state = createProgressState();
    const allIds = Array.from({ length: 80 }, (_, index) => index + 1);

    for (let id = 1; id <= 20; id += 1) {
      state.questions[id] = {
        seen: 1,
        correct: 0,
        wrong: 1,
        level: 0,
        lastExam: 0,
        recentWrong: 1
      };
    }

    const exam = buildExam(state, allIds, 30, predictableRng());
    const unseenCount = exam.filter((id) => id > 20).length;

    expect(exam).toHaveLength(30);
    expect(new Set(exam).size).toBe(30);
    expect(unseenCount).toBeGreaterThanOrEqual(20);
  });

  it("updates mastery counters for correct and wrong answers", () => {
    const state = createProgressState();
    startExam(state);

    recordAnswer(state, 7, true);
    recordAnswer(state, 8, false);

    expect(state.questions[7]).toMatchObject({ seen: 1, correct: 1, wrong: 0, level: 1 });
    expect(state.questions[8]).toMatchObject({ seen: 1, correct: 0, wrong: 1, level: 0 });
  });

  it("summarizes coverage and exposes weakest questions", () => {
    const state = createProgressState();
    startExam(state);
    recordAnswer(state, 1, true);
    recordAnswer(state, 2, false);

    const result = summary(state, [1, 2, 3, 4]);
    const weak = weakestIds(state, [1, 2, 3, 4], 1);

    expect(result.coveragePct).toBe(50);
    expect(result.weak).toBe(2);
    expect(weak[0].id).toBe(2);
  });
});

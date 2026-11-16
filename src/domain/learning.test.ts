import { describe, expect, it } from "vitest";
import { createProgressState, normalizeProgress, recordAnswer, recordExamResult, startExam } from "./engine";
import { dueCards, gradeCard } from "./flashcards";
import { awardBadges } from "./gamification";
import { computeStudentMetrics } from "./metrics";
import { buildSessionIds, type QuestionMeta } from "./modes";
import { dailyQueue, notebookEntries } from "./notebook";
import { studyPlan } from "./plan";
import { computeReadiness } from "./readiness";
import { mostConfused, practiceStreak, topicStats } from "./stats";
import type { TopicId } from "./types";

const DAY = 86_400_000;
const NOW = new Date("2026-11-16T12:00:00").getTime();

function bank(): QuestionMeta[] {
  return Array.from({ length: 60 }, (_, index) => ({
    id: index + 1,
    sign: index >= 40,
    topic: (index >= 40 ? "signs_warning" : index % 2 ? "gear" : "control") as TopicId
  }));
}

function rng(): () => number {
  let seed = 42;
  return () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("v1 migration", () => {
  it("normalises v1 progress into v2 with empty extras", () => {
    const v1 = { examIndex: 3, questions: { 5: { seen: 2, correct: 1, wrong: 1, level: 1, lastExam: 2, recentWrong: 0.5 } }, history: [{ at: 1, score: 20, total: 30, passed: false, examIndex: 1 }] };
    const state = normalizeProgress(v1);
    expect(state.version).toBe(2);
    expect(state.questions[5].level).toBe(1);
    expect(state.favorites).toEqual([]);
    expect(state.history).toHaveLength(1);
  });

  it("survives garbage", () => {
    expect(normalizeProgress("nope").questions).toEqual({});
    expect(normalizeProgress(null).history).toEqual([]);
  });
});

describe("session modes", () => {
  it("builds signs-only, unseen-only and topic sessions", () => {
    const state = createProgressState();
    const meta = bank();
    const signs = buildSessionIds("signs", state, meta, { size: 30, rng: rng() });
    expect(signs.every((id) => id > 40)).toBe(true);
    expect(signs).toHaveLength(20);

    recordAnswer(state, 1, true, { at: NOW });
    const unseen = buildSessionIds("unseen", state, meta, { size: 30, rng: rng() });
    expect(unseen).not.toContain(1);

    const topic = buildSessionIds("topic", state, meta, { size: 30, topic: "gear", rng: rng() });
    expect(topic.every((id) => meta[id - 1].topic === "gear")).toBe(true);
  });

  it("returns nothing for weak/favorites/mistakes on a fresh profile", () => {
    const state = createProgressState();
    for (const mode of ["weak", "favorites", "mistakes", "daily"] as const) {
      expect(buildSessionIds(mode, state, bank(), { size: 30, now: NOW })).toEqual([]);
    }
  });
});

describe("notebook", () => {
  it("tracks repeated and fixed mistakes plus confusion picks", () => {
    const state = createProgressState();
    recordAnswer(state, 1, false, { selected: 2, at: NOW });
    recordAnswer(state, 1, false, { selected: 2, at: NOW });
    recordAnswer(state, 2, false, { selected: 0, at: NOW });
    for (let i = 0; i < 3; i += 1) recordAnswer(state, 2, true, { at: NOW });
    const entries = notebookEntries(state, bank());
    expect(entries.find((entry) => entry.id === 1)?.status).toBe("repeated");
    expect(entries.find((entry) => entry.id === 2)?.status).toBe("fixed");
    expect(mostConfused(state, [1, 2])[0]).toMatchObject({ id: 1, confusedWith: 2 });
    expect(buildSessionIds("mistakes", state, bank(), { size: 30 })).toEqual([1]);
  });

  it("queues recently missed questions for daily review", () => {
    const state = createProgressState();
    startExam(state);
    recordAnswer(state, 3, false, { at: NOW - DAY });
    recordAnswer(state, 4, true, { at: NOW - DAY });
    expect(dailyQueue(state, [3, 4], NOW)).toContain(3);
  });
});

describe("readiness", () => {
  it("is capped and not ready without exams", () => {
    const readiness = computeReadiness(createProgressState(), bank(), NOW);
    expect(readiness.label).toBe("not_ready");
    expect(readiness.score).toBeLessThanOrEqual(50);
  });

  it("reaches ready after consistent passes with full coverage", () => {
    const state = createProgressState();
    const meta = bank();
    for (let round = 0; round < 6; round += 1) {
      startExam(state);
      for (const question of meta) recordAnswer(state, question.id, true, { at: NOW - DAY });
      recordExamResult(state, 29, 30, true, NOW - DAY, { mode: "timed", timed: true });
    }
    const readiness = computeReadiness(state, meta, NOW);
    expect(readiness.score).toBeGreaterThanOrEqual(85);
    expect(readiness.label).toBe("ready");
  });

  it("flags weak signs", () => {
    const state = createProgressState();
    const meta = bank();
    for (let round = 0; round < 3; round += 1) {
      startExam(state);
      for (const question of meta) recordAnswer(state, question.id, !question.sign || question.id % 3 === 0, { at: NOW });
      recordExamResult(state, 26, 30, true, NOW, { mode: "official" });
    }
    expect(computeReadiness(state, meta, NOW).label).toBe("needs_signs");
  });
});

describe("plan, badges, streaks and metrics", () => {
  it("starts with a first exam and then targets mistakes", () => {
    const state = createProgressState();
    const meta = bank();
    expect(studyPlan(state, meta, NOW)[0].kind).toBe("first_exam");
    startExam(state);
    recordAnswer(state, 1, false, { at: NOW });
    recordExamResult(state, 10, 30, false, NOW, { mode: "official" });
    expect(studyPlan(state, meta, NOW).map((step) => step.kind)).toContain("fix_mistakes");
  });

  it("awards badges once and counts streak days", () => {
    const state = createProgressState();
    for (let day = 2; day >= 0; day -= 1) recordAnswer(state, 1, true, { at: NOW - day * DAY });
    recordExamResult(state, 30, 30, true, NOW, { mode: "official" });
    const first = awardBadges(state, bank(), NOW);
    expect(first).toEqual(expect.arrayContaining(["first_exam", "first_pass", "perfect", "streak_3"]));
    expect(awardBadges(state, bank(), NOW)).toEqual([]);
    expect(practiceStreak(state, NOW)).toBe(3);
  });

  it("computes the metrics a linked student syncs", () => {
    const state = createProgressState();
    recordAnswer(state, 1, false, { at: NOW });
    recordAnswer(state, 2, true, { at: NOW });
    recordExamResult(state, 24, 30, false, NOW, { mode: "official" });
    recordExamResult(state, 12, 15, false, NOW, { mode: "practice" });
    const metrics = computeStudentMetrics(state, bank(), NOW);
    expect(metrics.examsTaken).toBe(1);
    expect(metrics.bestScorePct).toBe(80);
    expect(metrics.topicAccuracy.control).toBe(0);
    expect(metrics.topicAccuracy.gear).toBe(100);
    expect(topicStats(state, bank()).find((stat) => stat.topic === "gear")?.seen).toBe(1);
  });
});

describe("flashcards", () => {
  it("moves known cards out of the due queue", () => {
    const state = createProgressState();
    expect(dueCards(state, [41, 42], NOW)).toEqual([41, 42]);
    gradeCard(state, 41, true, NOW);
    expect(dueCards(state, [41, 42], NOW)).toEqual([42]);
    expect(dueCards(state, [41, 42], NOW + 2 * DAY)).toContain(41);
  });
});

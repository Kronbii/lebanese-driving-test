import { describe, expect, it } from "vitest";
import { createProgressState, recordAnswer, recordExamResult } from "../domain/engine";
import { decodeCompactBackup, encodeCompactBackup, makeBackup, parseBackup, type Profile } from "./profiles";

describe("profile backups", () => {
  it("round-trips a JSON backup file", () => {
    const state = createProgressState();
    recordAnswer(state, 7, false, { selected: 1 });
    state.favorites.push(7);
    const profile: Profile = { id: "p", name: "Rami", pinHash: null, color: "#000", createdAt: 0, cloud: null };
    const parsed = parseBackup(JSON.stringify(makeBackup(profile, state)));
    expect(parsed?.name).toBe("Rami");
    expect(parsed?.progress.questions[7].wrong).toBe(1);
    expect(parsed?.progress.favorites).toEqual([7]);
    expect(parseBackup("{}")).toBeNull();
  });

  it("round-trips the compact QR backup and stays small", async () => {
    const state = createProgressState();
    state.examIndex = 12;
    for (let id = 1; id <= 251; id += 1) recordAnswer(state, id, id % 4 !== 0);
    for (let exam = 0; exam < 12; exam += 1) recordExamResult(state, 25, 30, true, Date.now(), { mode: "official" });
    const encoded = await encodeCompactBackup(state);
    expect(encoded.length).toBeLessThan(2400);
    const decoded = await decodeCompactBackup(encoded);
    expect(decoded?.questions[4].wrong).toBe(1);
    expect(decoded?.questions[5].correct).toBe(1);
    expect(Object.keys(decoded?.questions ?? {})).toHaveLength(251);
    expect(decoded?.history).toHaveLength(12);
    expect(await decodeCompactBackup("garbage")).toBeNull();
  });
});

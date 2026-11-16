import type { ProgressState } from "./types";

/** Days until a card is due again, by box (0..5). */
const BOX_DAYS = [0, 1, 3, 7, 14, 30];

export function gradeCard(state: ProgressState, id: number, known: boolean, now = Date.now()): void {
  const card = state.flashcards[id] ?? { box: 0, due: now };
  card.box = known ? Math.min(BOX_DAYS.length - 1, card.box + 1) : 0;
  card.due = now + BOX_DAYS[card.box] * 86_400_000;
  state.flashcards[id] = card;
  state.updatedAt = now;
}

/** Cards due now (never-seen cards are due), most overdue first. */
export function dueCards(state: ProgressState, ids: number[], now = Date.now()): number[] {
  return ids
    .map((id) => ({ id, due: state.flashcards[id]?.due ?? 0, box: state.flashcards[id]?.box ?? -1 }))
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due || a.box - b.box)
    .map((card) => card.id);
}

export function knownCount(state: ProgressState, ids: number[]): number {
  return ids.filter((id) => (state.flashcards[id]?.box ?? 0) >= 3).length;
}

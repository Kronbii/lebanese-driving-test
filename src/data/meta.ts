import type { QuestionMeta } from "../domain/modes";
import type { BankId } from "../domain/types";
import { BANKS } from "./banks";
import { topicOf } from "./content";

const cache = new Map<BankId, QuestionMeta[]>();

/** Lightweight per-question info the domain logic needs (id, sign?, topic). */
export function questionMeta(bank: BankId): QuestionMeta[] {
  let meta = cache.get(bank);
  if (!meta) {
    meta = BANKS[bank].questions.map((question) => ({
      id: question.id,
      sign: Boolean(question.sign),
      topic: topicOf(question.id)
    }));
    cache.set(bank, meta);
  }
  return meta;
}

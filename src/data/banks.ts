import type { BankId, Localized, Question, TopicId } from "../domain/types";
import { QUESTIONS } from "./questions";
import { topicOf } from "./content";

export interface BankInfo {
  id: BankId;
  label: Localized;
  examSize: number;
  passScore: number;
  questions: Question[];
}

const ALL_QUESTIONS: Question[] = QUESTIONS;
const motorcycle = ALL_QUESTIONS.filter((question) => (question.category ?? "motorcycle") === "motorcycle");
const car = ALL_QUESTIONS.filter((question) => question.category === "car");

/**
 * Question banks. The car bank is wired in but empty until an official source is
 * imported with `npm run bank -- import`. The UI hides banks without questions.
 */
export const BANKS: Record<BankId, BankInfo> = {
  motorcycle: {
    id: "motorcycle",
    label: { ar: "الدراجات الآلية", en: "Motorcycle", fr: "Moto" },
    examSize: 30,
    passScore: 25,
    questions: motorcycle
  },
  car: {
    id: "car",
    label: { ar: "السيارات (فئة ب)", en: "Car (category B)", fr: "Voiture (catégorie B)" },
    examSize: 30,
    passScore: 25,
    questions: car
  }
};

export const AVAILABLE_BANKS: BankInfo[] = Object.values(BANKS).filter(
  (bank) => bank.questions.length > 0
);

export const QUESTIONS_BY_ID = new Map<number, Question>(
  ALL_QUESTIONS.map((question) => [question.id, question])
);

export function bankIds(bank: BankId): number[] {
  return BANKS[bank].questions.map((question) => question.id);
}

export function signIds(bank: BankId): number[] {
  return BANKS[bank].questions.filter((question) => question.sign).map((question) => question.id);
}

export function idsForTopic(bank: BankId, topic: TopicId): number[] {
  return BANKS[bank].questions.filter((question) => topicOf(question.id) === topic).map((q) => q.id);
}

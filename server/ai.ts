import Anthropic from "@anthropic-ai/sdk";
import type { Lang, Question } from "../src/domain/types.js";
import type { AiComplete } from "./context.js";
import type { Env } from "./lib.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

/**
 * Claude-backed completion, or null when ANTHROPIC_API_KEY is not set.
 * Short, low-effort single call; thinking is adaptive (cannot be disabled on Opus 5.5).
 */
export function anthropicCompleter(env: Env): AiComplete | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 45_000 });
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return async ({ system, prompt }) => {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      // On a policy decline, let the API retry on the model's default fallback chain.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: prompt }]
    });
    if (response.stop_reason === "refusal") throw new AiRefusal();
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("empty AI response");
    return text;
  };
}

export class AiRefusal extends Error {
  constructor() {
    super("refused");
  }
}

const LANG_NAMES: Record<Lang, string> = {
  ar: "Arabic (Modern Standard Arabic, simple words a Lebanese learner understands)",
  en: "English",
  fr: "French"
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function questionBlock(question: Question): string {
  const options = question.options
    .map((option, index) => `${LETTERS[index]}) ${option}`)
    .join("\n");
  return [
    `Official question #${question.id} (Arabic, official wording):`,
    question.text,
    question.sign
      ? "(The student also sees a road-sign picture with this question. You cannot see it: rely on the text and options, do not describe the picture's details.)"
      : "",
    "Options:",
    options,
    `Official correct answer: ${LETTERS[question.answer]}) ${question.options[question.answer]}`
  ]
    .filter(Boolean)
    .join("\n");
}

const SHARED_RULES = (lang: Lang) => [
  `Reply ONLY in ${LANG_NAMES[lang]}. Do not mix languages, except quoting an option if needed.`,
  "Keep it short: at most 120 words. Use simple, everyday words.",
  "Plain text only. No markdown, no bullet symbols, no headings, no emojis.",
  "The official question and its official correct answer are final. Never change, doubt, or contradict them, and never suggest a different answer is correct.",
  "Do not invent laws, fines or numbers that are not implied by the question. If unsure, explain the general safety reason instead."
];

export function explainPrompt(
  question: Question,
  options: { selected: number | null; style: "simple" | "nervous"; lang: Lang }
): { system: string; prompt: string } {
  const rules = [
    "You are a patient driving-theory tutor helping a student prepare for the Lebanese motorcycle/driving theory exam.",
    ...SHARED_RULES(options.lang),
    options.style === "nervous"
      ? "The student is nervous about the exam. Be calm, warm and reassuring. Start with one short encouraging sentence, then explain gently."
      : "Be clear and direct, like a friendly instructor."
  ];
  const { selected } = options;
  const pickedWrong =
    selected !== null && selected !== question.answer && selected >= 0 && selected < question.options.length;
  const task = [
    questionBlock(question),
    "",
    pickedWrong
      ? `The student picked ${LETTERS[selected]}) ${question.options[selected]}, which is wrong. Explain briefly why that pick is wrong, then why the official answer is right.`
      : selected === question.answer
        ? "The student picked the correct answer. Confirm it and explain why it is right so they remember it."
        : "Explain why the official correct answer is right.",
    "End with one short memory tip if it helps."
  ];
  return { system: rules.join("\n"), prompt: task.join("\n") };
}

export function instructorNotePrompt(
  question: Question,
  lang: Lang,
  stats: { students: number; wrong: number; seen: number; picks: number[] }
): { system: string; prompt: string } {
  const rules = [
    "You help driving-school instructors teach the official Lebanese driving theory questions in class.",
    ...SHARED_RULES(lang),
    "Write for the instructor, not the student: the likely misconception, then one concrete way to explain it in class (an example or a quick question to ask)."
  ];
  const pickText = stats.picks.some((count) => count > 0)
    ? `Wrong picks by option: ${stats.picks.map((count, index) => `${LETTERS[index]}=${count}`).join(", ")}.`
    : "";
  const statsText =
    stats.seen > 0
      ? `School data: ${stats.students} students answered this question ${stats.seen} times, ${stats.wrong} wrong. ${pickText}`
      : "No school answer data yet.";
  return { system: rules.join("\n"), prompt: [questionBlock(question), "", statsText].join("\n") };
}

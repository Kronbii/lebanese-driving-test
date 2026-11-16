/**
 * Question bank pipeline.
 *
 *   npm run bank -- validate                 Check every question + study content, print the checksum.
 *   npm run bank -- manifest                 Re-write src/data/bank-manifest.json (version, checksum, counts).
 *   npm run bank -- import <file> [--category car] [--dry-run]
 *        Add questions from a JSON array ({text, options[3], answer (0-2), sign?, category?})
 *        or a CSV with columns: text,option1,option2,option3,answer(1-3),sign,category
 *        New ids continue after the highest existing id. Writes src/data/questions.ts and the manifest.
 *
 * Study content (topics, explanations, translations) for new questions goes into
 * src/data/content/*.json; `validate` lists questions that still lack it.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BankId, Question, QuestionContent } from "../src/domain/types";
import { QUESTIONS } from "../src/data/questions";

const ROOT = join(import.meta.dirname, "..");
const QUESTIONS_FILE = join(ROOT, "src/data/questions.ts");
const MANIFEST_FILE = join(ROOT, "src/data/bank-manifest.json");
const CONTENT_DIR = join(ROOT, "src/data/content");
const ARABIC = /[؀-ۿ]/;

export function checksum(questions: Question[]): string {
  const canonical = questions
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((q) => [q.id, q.category ?? "motorcycle", q.text, q.options, q.answer, q.sign]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 16);
}

export function loadContent(): Map<number, QuestionContent> {
  const map = new Map<number, QuestionContent>();
  for (const name of readdirSync(CONTENT_DIR)) {
    if (!name.endsWith(".json")) continue;
    for (const item of JSON.parse(readFileSync(join(CONTENT_DIR, name), "utf8")) as QuestionContent[]) {
      map.set(item.id, item);
    }
  }
  return map;
}

const TOPIC_MAP_FILE = join(ROOT, "src/data/topic-map.json");

/** Topic per question id, loaded eagerly by the app (the full content loads lazily). */
export function buildTopicMap(content: Map<number, QuestionContent>): Record<string, string> {
  const ids = [...content.keys()].sort((a, b) => a - b);
  return Object.fromEntries(ids.map((id) => [String(id), (content.get(id) as QuestionContent).topic]));
}

function writeTopicMap() {
  writeFileSync(TOPIC_MAP_FILE, `${JSON.stringify(buildTopicMap(loadContent()), null, 0)}\n`);
}

export function validate(questions: Question[]): string[] {
  const problems: string[] = [];
  const ids = new Set<number>();
  for (const q of questions) {
    const where = `q${q.id}`;
    if (ids.has(q.id)) problems.push(`${where}: duplicate id`);
    ids.add(q.id);
    if (!Array.isArray(q.options) || q.options.length !== 3) problems.push(`${where}: needs exactly 3 options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) problems.push(`${where}: answer must be 0, 1 or 2`);
    if (new Set(q.options).size !== q.options.length) problems.push(`${where}: duplicate options`);
    if (q.sign) {
      if (!existsSync(join(ROOT, "public", q.sign))) problems.push(`${where}: sign image missing (${q.sign})`);
    } else if (!ARABIC.test(q.text)) {
      problems.push(`${where}: text has no Arabic letters`);
    }
    for (const option of q.options) {
      if (!option.trim()) problems.push(`${where}: empty option`);
      if (/Ã|Ø§|�/.test(option + q.text)) problems.push(`${where}: looks like broken encoding`);
    }
  }
  return problems;
}

function writeManifest(questions: Question[]) {
  const counts: Record<string, number> = {};
  for (const q of questions) counts[q.category ?? "motorcycle"] = (counts[q.category ?? "motorcycle"] ?? 0) + 1;
  const previous = existsSync(MANIFEST_FILE) ? (JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as { version: number; checksum: string }) : null;
  const sum = checksum(questions);
  const version = previous && previous.checksum === sum ? previous.version : (previous?.version ?? 0) + 1;
  const manifest = { version, checksum: sum, counts, signs: questions.filter((q) => q.sign).length };
  writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  writeTopicMap();
  return manifest;
}

export function formatQuestionsFile(questions: Question[], header: string): string {
  // Same one-line-per-question layout as the original file.
  const lines = questions.map((q) => {
    const options = q.options.map((option) => JSON.stringify(option)).join(", ");
    const category = q.category && q.category !== "motorcycle" ? `, "category": ${JSON.stringify(q.category)}` : "";
    return `  {"id": ${q.id}, "text": ${JSON.stringify(q.text)}, "options": [${options}], "answer": ${q.answer}, "sign": ${JSON.stringify(q.sign)}${category}}`;
  });
  return `${header}export const QUESTIONS = [\n${lines.join(",\n")}\n] satisfies Question[];\n`;
}

export function questionsFileHeader(): string {
  return readFileSync(QUESTIONS_FILE, "utf8").split("export const QUESTIONS")[0];
}

function writeQuestions(questions: Question[]) {
  writeFileSync(QUESTIONS_FILE, formatQuestionsFile(questions, questionsFileHeader()));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function readImport(file: string, category: BankId | undefined): Omit<Question, "id">[] {
  const raw = readFileSync(file, "utf8").replace(/^﻿/, "");
  if (file.endsWith(".json")) {
    const items = JSON.parse(raw) as Partial<Question>[];
    return items.map((item) => ({
      text: String(item.text ?? ""),
      options: (item.options ?? []).map(String),
      answer: Number(item.answer),
      sign: item.sign ? String(item.sign) : null,
      category: (item.category as BankId | undefined) ?? category
    }));
  }
  const [header, ...rows] = parseCsv(raw);
  const col = (name: string) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const index = { text: col("text"), o1: col("option1"), o2: col("option2"), o3: col("option3"), answer: col("answer"), sign: col("sign"), category: col("category") };
  return rows.map((cells) => ({
    text: cells[index.text]?.trim() ?? "",
    options: [cells[index.o1], cells[index.o2], cells[index.o3]].map((cell) => (cell ?? "").trim()),
    answer: Number(cells[index.answer]) - 1,
    sign: index.sign >= 0 && cells[index.sign]?.trim() ? cells[index.sign].trim() : null,
    category: ((index.category >= 0 && cells[index.category]?.trim()) || category) as BankId | undefined
  }));
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const current: Question[] = QUESTIONS;

  if (command === "validate" || !command) {
    const problems = validate(current);
    const content = loadContent();
    const missingContent = current.filter((q) => !content.has(q.id)).map((q) => q.id);
    console.log(`questions: ${current.length}, checksum: ${checksum(current)}`);
    if (missingContent.length) console.log(`missing study content: ${missingContent.join(", ")}`);
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log("ok");
    return;
  }

  if (command === "manifest") {
    console.log(writeManifest(current));
    return;
  }

  if (command === "import") {
    const file = args.find((arg) => !arg.startsWith("--"));
    if (!file) throw new Error("usage: npm run bank -- import <file.json|file.csv> [--category car] [--dry-run]");
    const categoryFlag = args.indexOf("--category");
    const category = categoryFlag >= 0 ? (args[categoryFlag + 1] as BankId) : undefined;
    let nextId = Math.max(...current.map((q) => q.id)) + 1;
    const added: Question[] = readImport(file, category).map((item) => ({ ...item, id: nextId++ }));
    const merged = [...current, ...added];
    const problems = validate(merged);
    if (problems.length) {
      console.error(problems.join("\n"));
      process.exit(1);
    }
    console.log(`importing ${added.length} questions (ids ${added[0]?.id}–${added[added.length - 1]?.id})`);
    if (args.includes("--dry-run")) return;
    writeQuestions(merged);
    console.log(writeManifest(merged));
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();

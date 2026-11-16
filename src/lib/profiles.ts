import {
  createProgressState,
  loadProgressFrom,
  normalizeProgress,
  saveProgressTo,
  STORAGE_KEY as LEGACY_KEY
} from "../domain/engine";
import type { ProgressState } from "../domain/types";

/** A linked school account (cloud mode). Only exists after the student consents. */
export interface CloudLink {
  studentId: string;
  deviceToken: string;
  schoolSlug: string;
  displayName: string;
  lastSyncAt: number | null;
}

export interface Profile {
  id: string;
  /** Empty string = the default profile (shown with a translated name). */
  name: string;
  /** sha-256 of a short PIN for shared school devices. Not real security, just separation. */
  pinHash: string | null;
  color: string;
  createdAt: number;
  cloud: CloudLink | null;
}

export interface ProfileRegistry {
  version: 1;
  activeId: string;
  profiles: Profile[];
}

export const REGISTRY_KEY = "ldt_profiles_v1";
const PROGRESS_PREFIX = "ldt_progress_v2:";
const COLORS = ["#0f766e", "#255f85", "#a16207", "#7c3aed", "#be185d", "#15803d", "#b42318"];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function progressKey(profileId: string): string {
  return `${PROGRESS_PREFIX}${profileId}`;
}

function makeProfile(name: string, index: number): Profile {
  return {
    id: newId(),
    name,
    pinHash: null,
    color: COLORS[index % COLORS.length],
    createdAt: Date.now(),
    cloud: null
  };
}

/** Loads the registry, creating a default profile (and migrating v1 progress) on first run. */
export function loadRegistry(): ProfileRegistry {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(REGISTRY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProfileRegistry;
        if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
          const activeId = parsed.profiles.some((p) => p.id === parsed.activeId)
            ? parsed.activeId
            : parsed.profiles[0].id;
          return { version: 1, activeId, profiles: parsed.profiles };
        }
      }
    } catch {
      // Fall through to a fresh registry.
    }
  }

  const first = makeProfile("", 0);
  const registry: ProfileRegistry = { version: 1, activeId: first.id, profiles: [first] };
  if (store) {
    const legacy = loadProgressFrom(store, LEGACY_KEY);
    saveProgressTo(store, progressKey(first.id), legacy);
    saveRegistry(registry);
  }
  return registry;
}

export function saveRegistry(registry: ProfileRegistry): void {
  try {
    storage()?.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Ignore storage failures (private mode).
  }
}

export function loadProfileProgress(profileId: string): ProgressState {
  const store = storage();
  return store ? loadProgressFrom(store, progressKey(profileId)) : createProgressState();
}

export function saveProfileProgress(profileId: string, state: ProgressState): void {
  const store = storage();
  if (store) saveProgressTo(store, progressKey(profileId), state);
}

export function removeProfileProgress(profileId: string): void {
  try {
    storage()?.removeItem(progressKey(profileId));
  } catch {
    // Ignore.
  }
}

export function addProfile(registry: ProfileRegistry, name: string): { registry: ProfileRegistry; profile: Profile } {
  const profile = makeProfile(name.trim().slice(0, 40), registry.profiles.length);
  return { registry: { ...registry, profiles: [...registry.profiles, profile] }, profile };
}

export async function hashPin(profileId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`ldt:${profileId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkPin(profile: Profile, pin: string): Promise<boolean> {
  if (!profile.pinHash) return true;
  return (await hashPin(profile.id, pin)) === profile.pinHash;
}

// ---------- backup files ----------

export interface ProfileBackup {
  format: "ldt-profile";
  version: 2;
  exportedAt: number;
  name: string;
  progress: ProgressState;
}

export function makeBackup(profile: Profile, progress: ProgressState): ProfileBackup {
  return { format: "ldt-profile", version: 2, exportedAt: Date.now(), name: profile.name, progress };
}

export function parseBackup(text: string): ProfileBackup | null {
  try {
    const data = JSON.parse(text) as Partial<ProfileBackup>;
    if (data.format !== "ldt-profile" || !data.progress) return null;
    return {
      format: "ldt-profile",
      version: 2,
      exportedAt: Number(data.exportedAt) || Date.now(),
      name: typeof data.name === "string" ? data.name : "",
      progress: normalizeProgress(data.progress)
    };
  } catch {
    return null;
  }
}

// ---------- compact QR backup ----------
// Layout: per seen question 6 bytes [id hi, id lo, level, seen, correct, wrong] (counts capped at 255),
// then up to 20 exam results [score, total, passed, mode index]. Deflated + base64url, carried in the URL
// fragment (#) so it never reaches a server.

const MODE_CODES = ["official", "timed", "practice", "strict", "final", "signs", "weak", "unseen", "topic", "favorites", "daily", "review", "mistakes"] as const;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

export async function encodeCompactBackup(progress: ProgressState): Promise<string> {
  const entries = Object.entries(progress.questions).filter(([, stat]) => stat.seen > 0);
  const history = progress.history.slice(-20);
  const bytes = new Uint8Array(4 + entries.length * 6 + 1 + history.length * 4);
  const cap = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  let offset = 0;
  bytes[offset++] = 3; // format version
  bytes[offset++] = cap(progress.examIndex);
  bytes[offset++] = (entries.length >> 8) & 0xff;
  bytes[offset++] = entries.length & 0xff;
  for (const [key, stat] of entries) {
    const id = Number(key);
    bytes[offset++] = (id >> 8) & 0xff;
    bytes[offset++] = id & 0xff;
    bytes[offset++] = cap(stat.level);
    bytes[offset++] = cap(stat.seen);
    bytes[offset++] = cap(stat.correct);
    bytes[offset++] = cap(stat.wrong);
  }
  bytes[offset++] = history.length;
  for (const item of history) {
    bytes[offset++] = cap(item.score);
    bytes[offset++] = cap(item.total);
    bytes[offset++] = item.passed ? 1 : 0;
    bytes[offset++] = Math.max(0, MODE_CODES.indexOf((item.mode ?? "official") as (typeof MODE_CODES)[number]));
  }
  return toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw")));
}

export async function decodeCompactBackup(text: string): Promise<ProgressState | null> {
  try {
    const bytes = await pipe(fromBase64Url(text), new DecompressionStream("deflate-raw"));
    if (bytes[0] !== 3 || bytes.length < 5) return null;
    const state = createProgressState();
    state.examIndex = bytes[1];
    const entries = (bytes[2] << 8) | bytes[3];
    let offset = 4;
    if (offset + entries * 6 + 1 > bytes.length) return null;
    for (let index = 0; index < entries; index += 1, offset += 6) {
      const id = (bytes[offset] << 8) | bytes[offset + 1];
      state.questions[id] = {
        level: Math.min(5, bytes[offset + 2]),
        seen: bytes[offset + 3],
        correct: bytes[offset + 4],
        wrong: bytes[offset + 5],
        lastExam: state.examIndex,
        recentWrong: bytes[offset + 5] > bytes[offset + 4] ? 0.5 : 0
      };
    }
    const count = bytes[offset++];
    if (offset + count * 4 > bytes.length) return null;
    const now = Date.now();
    for (let index = 0; index < count; index += 1, offset += 4) {
      state.history.push({
        at: now - (count - index) * 60_000,
        score: bytes[offset],
        total: bytes[offset + 1],
        passed: bytes[offset + 2] === 1,
        examIndex: index + 1,
        mode: MODE_CODES[bytes[offset + 3]] ?? "official"
      });
    }
    state.updatedAt = now;
    return state;
  } catch {
    return null;
  }
}

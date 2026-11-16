import type { ApiErrorBody, ErrorCode } from "./types";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;

  constructor(status: number, code: ErrorCode, message?: string) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer token (cloud student device token or live-classroom participant token). */
  token?: string | null;
  signal?: AbortSignal;
}

/** Calls /api<path>. Staff auth rides on the httpOnly session cookie. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      credentials: "same-origin",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "server_error", "network");
  }

  if (response.status === 204) return undefined as T;
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const body = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(response.status, body.error ?? "server_error", body.message);
  }
  return data as T;
}

/** Downloads a non-JSON endpoint (CSV/JSON export) as a file. */
export async function downloadFrom(path: string, filename: string, token?: string | null) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new ApiError(response.status, "server_error");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let healthPromise: Promise<{ ok: boolean; ai: boolean; email: boolean }> | null = null;

/** Whether the backend is reachable. Public mode works fully without it. */
export function apiHealth(): Promise<{ ok: boolean; ai: boolean; email: boolean }> {
  if (!healthPromise) {
    healthPromise = api<{ ok: true; ai: boolean; email: boolean }>("/health").catch(() => ({
      ok: false,
      ai: false,
      email: false
    }));
  }
  return healthPromise;
}

/** Fire-and-forget anonymous counter. Never sends personal data. */
export function trackEvent(kind: string, schoolSlug?: string | null, ref?: string | null) {
  void apiHealth().then((health) => {
    if (!health.ok) return;
    void api("/events", { body: { kind, schoolSlug: schoolSlug ?? null, ref: ref ?? null } }).catch(
      () => undefined
    );
  });
}

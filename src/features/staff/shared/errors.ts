import { ApiError } from "../../../api/client";
import type { ErrorCode } from "../../../api/types";

/** Translation key for every API error code (staff namespace, shared by admin and live). */
const ERROR_KEYS: Record<ErrorCode, string> = {
  bad_request: "staff.err_bad_request",
  unauthorized: "staff.err_unauthorized",
  forbidden: "staff.err_forbidden",
  not_found: "staff.err_not_found",
  conflict: "staff.err_conflict",
  rate_limited: "staff.err_rate_limited",
  feature_disabled: "staff.err_feature_disabled",
  limit_reached: "staff.err_limit_reached",
  school_suspended: "staff.err_school_suspended",
  consent_required: "staff.err_consent_required",
  invalid_code: "staff.err_invalid_code",
  expired: "staff.err_expired",
  ai_unavailable: "staff.err_ai_unavailable",
  server_error: "staff.err_server_error"
};

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export function errorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (isNetworkError(error)) return "staff.err_network";
    return ERROR_KEYS[error.code] ?? "staff.err_generic";
  }
  return "staff.err_generic";
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function hasCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiError && error.code === code;
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

const KEY = (code: string) => `ldt_live_${code}`;

export function loadToken(code: string): string | null {
  try {
    return window.sessionStorage.getItem(KEY(code));
  } catch {
    return null;
  }
}

export function saveToken(code: string, token: string) {
  try {
    window.sessionStorage.setItem(KEY(code), token);
  } catch {
    // Without storage the token lives only in memory for this visit.
  }
}

export function clearToken(code: string) {
  try {
    window.sessionStorage.removeItem(KEY(code));
  } catch {
    // Nothing stored.
  }
}

export function cleanCode(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 12);
}

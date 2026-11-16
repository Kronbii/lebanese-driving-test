import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "../api/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    trackEvent("install");
    listeners.forEach((listener) => listener());
  });
}

/** "Add to home screen" support (Android/desktop Chrome). iOS users get a hint instead. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred));

  useEffect(() => {
    const update = () => setCanInstall(Boolean(deferred));
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const prompt = useCallback(() => {
    if (!deferred) return;
    void deferred.prompt();
    void deferred.userChoice.finally(() => {
      deferred = null;
      setCanInstall(false);
    });
  }, []);

  return { canInstall, prompt };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export const SIGN_CACHE = "ldt-signs";

/** Downloads every sign image into the offline cache (used when low-data mode skips precaching). */
export async function cacheSignsForOffline(urls: string[], onProgress?: (done: number) => void): Promise<number> {
  if (!("caches" in window)) return 0;
  const cache = await caches.open(SIGN_CACHE);
  let done = 0;
  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (!existing) await cache.add(url);
    } catch {
      // Skip failures; the rest still caches.
    }
    done += 1;
    onProgress?.(done);
  }
  return done;
}

export async function cachedSignCount(urls: string[]): Promise<number> {
  if (!("caches" in window)) return 0;
  const cache = await caches.open(SIGN_CACHE);
  let count = 0;
  for (const url of urls) if (await cache.match(url)) count += 1;
  return count;
}

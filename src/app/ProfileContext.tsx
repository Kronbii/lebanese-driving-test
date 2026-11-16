import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { api } from "../api/client";
import type { ProgressSync } from "../api/types";
import { questionMeta } from "../data/meta";
import { cloneProgress, createProgressState, normalizeProgress } from "../domain/engine";
import { computeStudentMetrics } from "../domain/metrics";
import type { ProgressState } from "../domain/types";
import { QUESTIONS_BY_ID } from "../data/banks";
import { pruneUnknown } from "../domain/engine";
import {
  addProfile,
  checkPin,
  hashPin,
  loadProfileProgress as loadRawProgress,
  loadRegistry,
  removeProfileProgress,
  saveProfileProgress,
  saveRegistry,
  type CloudLink,
  type Profile,
  type ProfileRegistry
} from "../lib/profiles";
import { useSettings } from "./SettingsContext";

interface ProfileContextValue {
  profiles: Profile[];
  active: Profile;
  progress: ProgressState;
  /** True when the active profile has a PIN that has not been entered this visit. */
  locked: boolean;
  /** Apply a change to a copy of the progress and save it. Returns the new state. */
  mutate: (change: (draft: ProgressState) => void) => ProgressState;
  replaceProgress: (next: ProgressState) => void;
  resetProgress: () => void;
  /** Creates and activates a profile, optionally starting from imported progress. */
  createProfile: (name: string, initial?: ProgressState) => Profile;
  switchProfile: (id: string, pin?: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  renameProfile: (id: string, name: string) => void;
  setPin: (id: string, pin: string | null) => Promise<void>;
  deleteProfile: (id: string) => void;
  linkCloud: (link: CloudLink, serverProgress?: ProgressState | null) => void;
  unlinkCloud: () => void;
  /** Sync state of the cloud link, if any. */
  syncStatus: "off" | "idle" | "syncing" | "error";
  syncNow: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const KNOWN_IDS = [...QUESTIONS_BY_ID.keys()];

/** Loads a profile's progress, dropping questions no longer in the bank (bank updates). */
function loadProfileProgress(profileId: string): ProgressState {
  const state = loadRawProgress(profileId);
  pruneUnknown(state, KNOWN_IDS);
  return state;
}

const SYNC_DELAY = 4000;

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [registry, setRegistry] = useState<ProfileRegistry>(loadRegistry);
  const active = registry.profiles.find((p) => p.id === registry.activeId) ?? registry.profiles[0];
  const [progress, setProgress] = useState<ProgressState>(() => loadProfileProgress(active.id));
  const progressRef = useRef(progress);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());
  const [syncStatus, setSyncStatus] = useState<ProfileContextValue["syncStatus"]>(
    active.cloud ? "idle" : "off"
  );
  const syncTimer = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const commitRegistry = useCallback((next: ProfileRegistry) => {
    saveRegistry(next);
    setRegistry(next);
  }, []);

  const syncNow = useCallback(async () => {
    const profile = activeRef.current;
    if (!profile.cloud) return;
    setSyncStatus("syncing");
    try {
      const body: ProgressSync = {
        progress: progressRef.current,
        metrics: computeStudentMetrics(progressRef.current, questionMeta(settings.bank))
      };
      await api("/student/progress", { method: "PUT", body, token: profile.cloud.deviceToken });
      setSyncStatus("idle");
      setRegistry((current) => {
        const next = {
          ...current,
          profiles: current.profiles.map((p) =>
            p.id === profile.id && p.cloud ? { ...p, cloud: { ...p.cloud, lastSyncAt: Date.now() } } : p
          )
        };
        saveRegistry(next);
        return next;
      });
    } catch {
      setSyncStatus("error");
    }
  }, [settings.bank]);

  const scheduleSync = useCallback(() => {
    if (!activeRef.current.cloud) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => void syncNow(), SYNC_DELAY);
  }, [syncNow]);

  const replaceProgress = useCallback(
    (next: ProgressState) => {
      progressRef.current = next;
      setProgress(next);
      saveProfileProgress(activeRef.current.id, next);
      scheduleSync();
    },
    [scheduleSync]
  );

  const mutate = useCallback(
    (change: (draft: ProgressState) => void) => {
      const draft = cloneProgress(progressRef.current);
      change(draft);
      draft.updatedAt = Date.now();
      replaceProgress(draft);
      return draft;
    },
    [replaceProgress]
  );

  const resetProgress = useCallback(() => {
    replaceProgress(createProgressState());
  }, [replaceProgress]);

  // On loading a cloud-linked profile, adopt the server copy when it is newer (other device).
  useEffect(() => {
    const cloud = active.cloud;
    setSyncStatus(cloud ? "idle" : "off");
    if (!cloud) return;
    let cancelled = false;
    api<{ progress: ProgressState | null; savedAt: string | null }>("/student/progress", {
      token: cloud.deviceToken
    })
      .then((response) => {
        if (cancelled || !response.progress) return;
        const remote = normalizeProgress(response.progress);
        if (remote.updatedAt > progressRef.current.updatedAt) {
          progressRef.current = remote;
          setProgress(remote);
          saveProfileProgress(active.id, remote);
        }
      })
      .catch(() => {
        if (!cancelled) setSyncStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // Only when the active profile or its link changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, active.cloud?.deviceToken]);

  useEffect(() => {
    const flush = () => {
      if (syncTimer.current && activeRef.current.cloud) {
        window.clearTimeout(syncTimer.current);
        syncTimer.current = null;
        void syncNow();
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [syncNow]);

  const activate = useCallback(
    (id: string) => {
      const next = { ...registry, activeId: id };
      commitRegistry(next);
      const loaded = loadProfileProgress(id);
      progressRef.current = loaded;
      setProgress(loaded);
    },
    [commitRegistry, registry]
  );

  const createProfile = useCallback(
    (name: string, initial?: ProgressState) => {
      const { registry: next, profile } = addProfile(registry, name);
      commitRegistry({ ...next, activeId: profile.id });
      const fresh = initial ? normalizeProgress(initial) : createProgressState();
      saveProfileProgress(profile.id, fresh);
      progressRef.current = fresh;
      setProgress(fresh);
      setUnlockedIds((current) => new Set(current).add(profile.id));
      return profile;
    },
    [commitRegistry, registry]
  );

  const switchProfile = useCallback(
    async (id: string, pin?: string) => {
      const profile = registry.profiles.find((p) => p.id === id);
      if (!profile) return false;
      if (profile.pinHash && !unlockedIds.has(id)) {
        if (!pin || !(await checkPin(profile, pin))) return false;
        setUnlockedIds((current) => new Set(current).add(id));
      }
      activate(id);
      return true;
    },
    [activate, registry.profiles, unlockedIds]
  );

  const unlock = useCallback(
    async (pin: string) => {
      if (await checkPin(active, pin)) {
        setUnlockedIds((current) => new Set(current).add(active.id));
        return true;
      }
      return false;
    },
    [active]
  );

  const renameProfile = useCallback(
    (id: string, name: string) => {
      commitRegistry({
        ...registry,
        profiles: registry.profiles.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 40) } : p))
      });
    },
    [commitRegistry, registry]
  );

  const setPin = useCallback(
    async (id: string, pin: string | null) => {
      const pinHash = pin ? await hashPin(id, pin) : null;
      commitRegistry({
        ...registry,
        profiles: registry.profiles.map((p) => (p.id === id ? { ...p, pinHash } : p))
      });
      if (pin) setUnlockedIds((current) => new Set(current).add(id));
    },
    [commitRegistry, registry]
  );

  const deleteProfile = useCallback(
    (id: string) => {
      const remaining = registry.profiles.filter((p) => p.id !== id);
      removeProfileProgress(id);
      if (!remaining.length) {
        const { registry: fresh, profile } = addProfile({ ...registry, profiles: [] }, "");
        commitRegistry({ ...fresh, activeId: profile.id });
        const state = createProgressState();
        saveProfileProgress(profile.id, state);
        progressRef.current = state;
        setProgress(state);
        return;
      }
      const activeId = registry.activeId === id ? remaining[0].id : registry.activeId;
      commitRegistry({ ...registry, profiles: remaining, activeId });
      if (activeId !== registry.activeId) {
        const loaded = loadProfileProgress(activeId);
        progressRef.current = loaded;
        setProgress(loaded);
      }
    },
    [commitRegistry, registry]
  );

  const linkCloud = useCallback(
    (link: CloudLink, serverProgress?: ProgressState | null) => {
      commitRegistry({
        ...registry,
        profiles: registry.profiles.map((p) => (p.id === active.id ? { ...p, cloud: link } : p))
      });
      if (serverProgress) {
        const remote = normalizeProgress(serverProgress);
        if (remote.updatedAt > progressRef.current.updatedAt) {
          progressRef.current = remote;
          setProgress(remote);
          saveProfileProgress(active.id, remote);
        }
      }
      setSyncStatus("idle");
      window.setTimeout(() => void syncNow(), 50);
    },
    [active.id, commitRegistry, registry, syncNow]
  );

  const unlinkCloud = useCallback(() => {
    commitRegistry({
      ...registry,
      profiles: registry.profiles.map((p) => (p.id === active.id ? { ...p, cloud: null } : p))
    });
    setSyncStatus("off");
  }, [active.id, commitRegistry, registry]);

  const locked = Boolean(active.pinHash) && !unlockedIds.has(active.id);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles: registry.profiles,
      active,
      progress,
      locked,
      mutate,
      replaceProgress,
      resetProgress,
      createProfile,
      switchProfile,
      unlock,
      renameProfile,
      setPin,
      deleteProfile,
      linkCloud,
      unlinkCloud,
      syncStatus,
      syncNow
    }),
    [
      registry.profiles,
      active,
      progress,
      locked,
      mutate,
      replaceProgress,
      resetProgress,
      createProfile,
      switchProfile,
      unlock,
      renameProfile,
      setPin,
      deleteProfile,
      linkCloud,
      unlinkCloud,
      syncStatus,
      syncNow
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider");
  return context;
}

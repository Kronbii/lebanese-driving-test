import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { PLAN_FEATURES, type FeatureFlag, type PublicSchool } from "../api/types";
import { DEMO_SCHOOL } from "../data/demoSchool";

export interface SchoolContextValue {
  /** null in public mode (no school). */
  school: PublicSchool | null;
  slug: string | null;
  status: "public" | "loading" | "ready" | "missing";
  /** Path prefix for trainer pages: "" (public) or "/s/<slug>/learn". */
  base: string;
  /** Builds a trainer link: link("exam/official") -> "/s/demo/learn/exam/official". */
  link: (path?: string) => string;
  /** Feature check; public mode allows every device-local feature. */
  can: (flag: FeatureFlag) => boolean;
}

const PUBLIC_FEATURES = { ...PLAN_FEATURES.premium, cloudStudents: true, ai: true };

const SchoolContext = createContext<SchoolContextValue>(makeValue(null, null, "public"));

function makeValue(
  slug: string | null,
  school: PublicSchool | null,
  status: SchoolContextValue["status"]
): SchoolContextValue {
  const base = slug ? `/s/${slug}/learn` : "";
  return {
    school,
    slug,
    status,
    base,
    link: (path = "") => {
      const clean = path.replace(/^\/+/, "");
      if (!clean) return base || "/";
      return `${base}/${clean}`;
    },
    can: (flag) => (school ? Boolean(school.features[flag]) : Boolean(PUBLIC_FEATURES[flag]))
  };
}

const schoolCache = new Map<string, PublicSchool>();

export function fetchSchool(slug: string): Promise<PublicSchool | null> {
  const cached = schoolCache.get(slug);
  if (cached) return Promise.resolve(cached);
  return api<PublicSchool>(`/schools/${encodeURIComponent(slug)}`)
    .then((school) => {
      schoolCache.set(slug, school);
      return school;
    })
    .catch((error) => {
      if (slug === "demo") return DEMO_SCHOOL;
      if (error instanceof ApiError && error.status === 404) return null;
      return null;
    });
}

/** Applies school colours to the page while mounted. */
function useBranding(school: PublicSchool | null) {
  useEffect(() => {
    if (!school) return;
    const root = document.documentElement;
    const { primaryColor, accentColor } = school.branding;
    const valid = (color: string) => /^#[0-9a-f]{6}$/i.test(color);
    if (valid(primaryColor)) {
      root.style.setProperty("--primary", primaryColor);
      root.style.setProperty("--primary-strong", `color-mix(in srgb, ${primaryColor} 82%, black)`);
      root.style.setProperty("--primary-soft", `color-mix(in srgb, ${primaryColor} 14%, var(--surface))`);
    }
    if (valid(accentColor)) {
      root.style.setProperty("--accent", accentColor);
      root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accentColor} 14%, var(--surface))`);
    }
    return () => {
      for (const name of ["--primary", "--primary-strong", "--primary-soft", "--accent", "--accent-soft"]) {
        root.style.removeProperty(name);
      }
    };
  }, [school]);
}

export function SchoolProvider({ slug, children }: { slug: string | null; children: ReactNode }) {
  const [school, setSchool] = useState<PublicSchool | null>(() =>
    slug ? schoolCache.get(slug) ?? null : null
  );
  const [status, setStatus] = useState<SchoolContextValue["status"]>(
    slug ? (school ? "ready" : "loading") : "public"
  );

  useEffect(() => {
    if (!slug) {
      setSchool(null);
      setStatus("public");
      return;
    }
    let cancelled = false;
    setStatus((current) => (current === "ready" && school?.slug === slug ? current : "loading"));
    void fetchSchool(slug).then((result) => {
      if (cancelled) return;
      setSchool(result);
      setStatus(result ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useBranding(school);

  const value = useMemo(() => makeValue(slug, school, status), [slug, school, status]);
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolContextValue {
  return useContext(SchoolContext);
}

import type {
  LocalizedText,
  SchoolBranding,
  SchoolContact,
  SchoolLanding,
  SchoolSettings,
  SchoolUpdate
} from "../../../api/types";

export interface SchoolDraft {
  name: LocalizedText;
  branding: SchoolBranding;
  contact: SchoolContact;
  landing: SchoolLanding;
  collectPhone: boolean;
  retentionDays: number | null;
}

export type DraftPatch = (draft: SchoolDraft) => SchoolDraft;

export const EMPTY_CONTACT: SchoolContact = {
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  mapUrl: null,
  instagram: null,
  tiktok: null,
  facebook: null,
  website: null
};

export function draftFrom(school: SchoolSettings): SchoolDraft {
  return {
    name: { ...school.name },
    branding: { ...school.branding },
    contact: { ...EMPTY_CONTACT, ...school.contact },
    landing: {
      headline: school.landing?.headline ?? null,
      about: school.landing?.about ?? null,
      testimonials: school.landing?.testimonials ?? [],
      passRate: school.landing?.passRate ?? null,
      showStats: school.landing?.showStats ?? false
    },
    collectPhone: school.collectPhone,
    retentionDays: school.retentionDays
  };
}

function cleanLocalized(value: LocalizedText | null): LocalizedText | null {
  if (!value) return null;
  const ar = value.ar.trim();
  const en = value.en?.trim() ?? "";
  const fr = value.fr?.trim() ?? "";
  if (!ar && !en && !fr) return null;
  const result: LocalizedText = { ar };
  if (en) result.en = en;
  if (fr) result.fr = fr;
  return result;
}

function clean(value: string | null): string | null {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export type DraftProblem = "nameAr" | "headlineAr" | "aboutAr" | "color" | "passRate" | "retention";

export function validateDraft(draft: SchoolDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.name.ar.trim()) problems.push("nameAr");
  const headline = cleanLocalized(draft.landing.headline);
  if (headline && !headline.ar) problems.push("headlineAr");
  const about = cleanLocalized(draft.landing.about);
  if (about && !about.ar) problems.push("aboutAr");
  if (!HEX.test(draft.branding.primaryColor) || !HEX.test(draft.branding.accentColor)) problems.push("color");
  const pass = draft.landing.passRate;
  if (pass && (!Number.isFinite(pass.value) || pass.value < 0 || pass.value > 100)) problems.push("passRate");
  if (draft.retentionDays !== null && (!Number.isInteger(draft.retentionDays) || draft.retentionDays < 30)) {
    problems.push("retention");
  }
  return problems;
}

export function toUpdate(draft: SchoolDraft): SchoolUpdate {
  const contact = Object.fromEntries(
    Object.entries(draft.contact).map(([key, value]) => [key, clean(value)])
  ) as unknown as SchoolContact;
  if (contact.whatsapp) contact.whatsapp = contact.whatsapp.replace(/\D/g, "");
  return {
    name: cleanLocalized(draft.name) ?? { ar: draft.name.ar.trim() },
    branding: {
      logoUrl: clean(draft.branding.logoUrl),
      primaryColor: draft.branding.primaryColor,
      accentColor: draft.branding.accentColor
    },
    contact,
    landing: {
      headline: cleanLocalized(draft.landing.headline),
      about: cleanLocalized(draft.landing.about),
      testimonials: draft.landing.testimonials
        .map((item) => ({ name: item.name.trim(), text: item.text.trim() }))
        .filter((item) => item.text),
      passRate: draft.landing.passRate
        ? {
            value: Math.round(draft.landing.passRate.value),
            verified: draft.landing.passRate.verified,
            ...(draft.landing.passRate.note?.trim() ? { note: draft.landing.passRate.note.trim() } : {})
          }
        : null,
      showStats: draft.landing.showStats
    },
    collectPhone: draft.collectPhone,
    retentionDays: draft.retentionDays
  };
}

/** Readable text colour (black/white) on a background hex colour. */
export function textOn(hex: string): string {
  if (!HEX.test(hex)) return "#ffffff";
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? "#111111" : "#ffffff";
}

import { PLAN_FEATURES, type PublicSchool } from "../api/types";

/**
 * Bundled copy of the demo school so /s/demo works on a static deploy without
 * the API. Real schools always come from the API.
 */
export const DEMO_SCHOOL: PublicSchool = {
  id: "demo",
  slug: "demo",
  name: { ar: "مدرسة القيادة التجريبية", en: "Demo Driving School", fr: "Auto-école Démo" },
  branding: { logoUrl: null, primaryColor: "#0f766e", accentColor: "#255f85" },
  contact: {
    phone: "+961 00 000 000",
    whatsapp: "96100000000",
    email: null,
    address: "بيروت، لبنان",
    mapUrl: null,
    instagram: null,
    tiktok: null,
    facebook: null,
    website: null
  },
  landing: {
    headline: {
      ar: "تدرّب على فحص الدراجات النارية مع مدرستك",
      en: "Practise for your motorcycle theory exam with your school",
      fr: "Préparez l'examen théorique moto avec votre auto-école"
    },
    about: {
      ar: "هذه صفحة تجريبية تُظهر كيف تبدو صفحة مدرسة القيادة.",
      en: "This is a demo page showing what a driving school's page looks like.",
      fr: "Ceci est une page de démonstration d'auto-école."
    },
    testimonials: [],
    passRate: null,
    showStats: false
  },
  branches: [],
  features: { ...PLAN_FEATURES.premium },
  stats: { studentsTrained: 0, examsCompleted: 0 },
  collectPhone: true,
  status: "active"
};

import type { NamespaceMessages } from "./types";

export const embed = {
  ar: {
    appName: "تدرّب على فحص القيادة",
    subtitle: "سؤال من الفحص الرسمي",
    scoreLabel: "{correct} صحيحة من {total}",
    signAlt: "إشارة السؤال رقم {n}",
    official: "النص الرسمي:",
    correct: "إجابة صحيحة!",
    wrong: "ليست الإجابة الصحيحة.",
    next: "السؤال التالي",
    skip: "تخطَّ",
    openTrainer: "افتح التدريب الكامل",
    empty: "لا توجد أسئلة."
  },
  en: {
    appName: "Driving theory practice",
    subtitle: "A question from the official exam",
    scoreLabel: "{correct} correct out of {total}",
    signAlt: "Road sign for question {n}",
    official: "Official:",
    correct: "Correct!",
    wrong: "Not quite.",
    next: "Next question",
    skip: "Skip",
    openTrainer: "Open the full trainer",
    empty: "No questions available."
  },
  fr: {
    appName: "Entraînement au code",
    subtitle: "Une question de l'examen officiel",
    scoreLabel: "{correct} bonnes réponses sur {total}",
    signAlt: "Panneau de la question {n}",
    official: "Officiel :",
    correct: "Bonne réponse !",
    wrong: "Pas tout à fait.",
    next: "Question suivante",
    skip: "Passer",
    openTrainer: "Ouvrir l'entraînement complet",
    empty: "Aucune question disponible."
  }
} satisfies NamespaceMessages;

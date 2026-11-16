import type { Lang } from "../domain/types";

const LOCALES: Record<Lang, string[]> = {
  ar: ["ar-LB", "ar-SA", "ar"],
  en: ["en-GB", "en-US", "en"],
  fr: ["fr-FR", "fr"]
};

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const locale of LOCALES[lang]) {
    const match = voices.find((voice) => voice.lang.toLowerCase().startsWith(locale.toLowerCase()));
    if (match) return match;
  }
  return undefined;
}

/** Reads text aloud with the device's built-in voice for that language. */
export function speak(text: string, lang: Lang): void {
  if (!canSpeak() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[lang][0];
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function hasVoiceFor(lang: Lang): boolean {
  if (!canSpeak()) return false;
  return Boolean(pickVoice(lang));
}

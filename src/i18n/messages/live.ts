import type { NamespaceMessages } from "./types";

/** [key, ar, en, fr] — one row per key keeps the three languages in sync. */
type Row = readonly [key: string, ar: string, en: string, fr: string];

const ROWS: readonly Row[] = [
  ["brand", "الصف المباشر", "Live class", "Classe en direct"],
  ["enterCodeTitle", "انضمّ إلى الصف", "Join the class", "Rejoindre la classe"],
  ["enterCodeIntro", "أدخل الرمز المؤلّف من ٦ أرقام الظاهر على الشاشة.", "Enter the 6-digit code shown on the screen.", "Saisissez le code à 6 chiffres affiché à l’écran."],
  ["codeLabel", "رمز الجلسة", "Session code", "Code de la séance"],
  ["continue", "متابعة", "Continue", "Continuer"],
  ["joinTitle", "انضمام", "Join", "Rejoindre"],
  ["nameOptional", "اسمك (اختياري)", "Your name (optional)", "Votre prénom (facultatif)"],
  ["nameRequired", "اسمك (مطلوب لهذه الجلسة)", "Your name (needed for this session)", "Votre prénom (requis pour cette séance)"],
  ["namePlaceholder", "مثال: علي", "e.g. Ali", "ex. Ali"],
  ["nameHint", "يظهر في الترتيب. يمكنك استخدام اسم مستعار.", "Shown on the leaderboard. A nickname is fine.", "Affiché au classement. Un pseudo suffit."],
  ["joinButton", "انضمّ", "Join", "Rejoindre"],
  ["joining", "جارٍ الانضمام…", "Joining…", "Connexion…"],
  ["differentCode", "إدخال رمز آخر", "Use a different code", "Utiliser un autre code"],
  ["sessionNotFound", "لم نجد جلسة بهذا الرمز، أو انتهت.", "No session with this code, or it has ended.", "Aucune séance avec ce code, ou elle est terminée."],
  ["sessionLost", "انقطع اتصالك بالجلسة. انضمّ من جديد.", "You were disconnected from the session. Please join again.", "Vous avez été déconnecté. Rejoignez la séance à nouveau."],
  ["reconnecting", "جارٍ إعادة الاتصال…", "Reconnecting…", "Reconnexion…"],
  ["youreIn", "أنت في الصف يا {name}!", "You’re in, {name}!", "C’est bon, {name} !"],
  ["youreInAnon", "أنت في الصف!", "You’re in!", "C’est bon, vous êtes inscrit !"],
  ["waiting", "بانتظار أن يبدأ المدرّب…", "Waiting for the instructor to start…", "En attente du moniteur…"],
  ["questionOf", "السؤال {index} من {total}", "Question {index} of {total}", "Question {index} sur {total}"],
  ["score", "النقاط: {score}", "Score: {score}", "Score : {score}"],
  ["chooseAnswer", "اختر إجابة", "Choose an answer", "Choisissez une réponse"],
  ["tapToAnswer", "اضغط على إجابة واحدة.", "Tap one answer.", "Touchez une réponse."],
  ["locked", "تمّ تسجيل إجابتك. انتظر إظهار الإجابة الصحيحة.", "Answer locked in. Wait for the reveal.", "Réponse enregistrée. Attendez la correction."],
  ["correct", "إجابة صحيحة!", "Correct!", "Bonne réponse !"],
  ["incorrect", "إجابة خاطئة", "Not quite", "Mauvaise réponse"],
  ["noAnswer", "لم تُجب على هذا السؤال", "You didn’t answer this one", "Pas de réponse à cette question"],
  ["correctAnswer", "الإجابة الصحيحة", "Correct answer", "Bonne réponse"],
  ["yourAnswer", "إجابتك", "Your answer", "Votre réponse"],
  ["ended", "انتهت الجلسة", "Session over", "Séance terminée"],
  ["finalScore", "نتيجتك: {score} من {total}", "Your score: {score} of {total}", "Votre score : {score} sur {total}"],
  ["leaderboard", "الترتيب", "Leaderboard", "Classement"],
  ["anonymous", "مشارك", "Player", "Participant"],
  ["joinAnother", "الانضمام إلى جلسة أخرى", "Join another session", "Rejoindre une autre séance"]
];

function build(rows: readonly Row[]): NamespaceMessages {
  const messages: NamespaceMessages = { ar: {}, en: {}, fr: {} };
  for (const [key, ar, en, fr] of rows) {
    messages.ar[key] = ar;
    messages.en[key] = en;
    messages.fr[key] = fr;
  }
  return messages;
}

export const live: NamespaceMessages = build(ROWS);

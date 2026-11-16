import type { NamespaceMessages } from "./types";

/** [key, ar, en, fr] — one row per key keeps the three languages in sync. */
type Row = readonly [key: string, ar: string, en: string, fr: string];

const ROWS: readonly Row[] = [
  ["title", "إدارة المنصّة", "Platform admin", "Administration de la plateforme"],
  ["navLabel", "أقسام الإدارة", "Admin sections", "Sections d’administration"],
  ["navSchools", "المدارس", "Schools", "Écoles"],
  ["navUsage", "الاستخدام", "Usage", "Utilisation"],
  ["navAudit", "سجلّ النشاط", "Audit log", "Journal d’activité"],
  ["navErrors", "الأخطاء", "Errors", "Erreurs"],
  ["navStaff", "لوحة الموظفين", "Staff dashboard", "Espace personnel"],
  ["forbiddenTitle", "غير مسموح", "Not allowed", "Accès refusé"],
  ["forbiddenBody", "هذه الصفحة لإدارة المنصّة فقط.", "This area is for platform admins only.", "Cet espace est réservé aux administrateurs de la plateforme."],
  ["backToStaff", "العودة إلى لوحة الموظفين", "Back to the staff dashboard", "Retour à l’espace personnel"],

  ["schoolsTitle", "المدارس", "Schools", "Écoles"],
  ["schoolsIntro", "كل المدارس على المنصّة مع الاستخدام والاشتراك.", "Every school on the platform, with usage and billing.", "Toutes les écoles de la plateforme, avec utilisation et abonnement."],
  ["schoolsEmpty", "لا توجد مدارس بعد.", "No schools yet.", "Aucune école pour l’instant."],
  ["searchSchools", "ابحث بالاسم أو الرابط", "Search by name or slug", "Rechercher par nom ou identifiant"],
  ["newSchool", "مدرسة جديدة", "New school", "Nouvelle école"],
  ["createSchool", "إنشاء المدرسة", "Create school", "Créer l’école"],
  ["school", "المدرسة", "School", "École"],
  ["students", "الطلاب", "Students", "Élèves"],
  ["linked", "مرتبطون", "Linked", "Liés"],
  ["linkedCount", "{count} مرتبط", "{count} linked", "{count} liés"],
  ["exams30d", "امتحانات (٣٠ يومًا)", "Exams (30 days)", "Examens (30 j)"],
  ["leads30d", "طلبات (٣٠ يومًا)", "Leads (30 days)", "Prospects (30 j)"],
  ["staffCount", "الموظفون", "Staff", "Personnel"],
  ["slug", "الرابط المختصر (slug)", "Slug", "Identifiant (slug)"],
  ["slugInvalid", "من ٣ إلى ٤٠ حرفًا: أحرف إنكليزية صغيرة وأرقام وشرطات.", "3–40 characters: lowercase letters, numbers and dashes.", "3 à 40 caractères : minuscules, chiffres et tirets."],
  ["slugChangeWarning", "تغيير الرابط يعطّل رموز QR والروابط القديمة.", "Changing the slug breaks existing QR codes and links.", "Changer l’identifiant casse les QR codes et liens existants."],
  ["adminEmail", "بريد مدير المدرسة", "School admin email", "E-mail de l’administrateur"],
  ["adminName", "اسم مدير المدرسة", "School admin name", "Nom de l’administrateur"],
  ["adminHint", "اختياري: يُنشأ حساب مدير للمدرسة ويدخل عبر رابط بالبريد.", "Optional: creates a school admin who signs in with an emailed link.", "Facultatif : crée un administrateur qui se connecte via un lien par e-mail."],
  ["backToSchools", "كل المدارس", "All schools", "Toutes les écoles"],
  ["openPublicPage", "فتح الصفحة العامة", "Open public page", "Ouvrir la page publique"],
  ["subscription", "الاشتراك", "Subscription", "Abonnement"],
  ["billingNote", "ملاحظة الفوترة", "Billing note", "Note de facturation"],
  ["features", "الميزات", "Features", "Fonctionnalités"],
  ["feature", "الميزة", "Feature", "Fonctionnalité"],
  ["planDefault", "افتراضي الباقة", "Plan default", "Par défaut"],
  ["override", "استثناء", "Override", "Dérogation"],
  ["effective", "الفعلي", "Effective", "Effectif"],
  ["useDefault", "حسب الباقة", "Use plan default", "Selon la formule"],
  ["forceOn", "تفعيل دائمًا", "Force on", "Toujours activé"],
  ["forceOff", "إيقاف دائمًا", "Force off", "Toujours désactivé"],
  ["overridden", "مُستثنى", "overridden", "dérogation"],
  ["on", "مفعّل", "On", "Activé"],
  ["off", "متوقّف", "Off", "Désactivé"],
  ["verifyPassRate", "نسبة النجاح موثّقة (تظهر للعموم)", "Pass rate verified (shown publicly)", "Taux de réussite vérifié (affiché publiquement)"],
  ["verifyHint", "وثّق النسبة فقط بعد الاطّلاع على مستندات تثبتها.", "Only verify after seeing supporting documents.", "Ne vérifiez qu’après avoir vu des justificatifs."],
  ["noPassRate", "لم تضف المدرسة نسبة نجاح.", "The school has not added a pass rate.", "L’école n’a pas indiqué de taux de réussite."],
  ["dangerZone", "منطقة الخطر", "Danger zone", "Zone dangereuse"],
  ["deleteSchool", "حذف المدرسة", "Delete school", "Supprimer l’école"],
  ["deleteSchoolBody", "يحذف المدرسة وكل طلابها وموظفيها وبياناتها نهائيًا.", "Permanently deletes the school with all its students, staff and data.", "Supprime définitivement l’école avec ses élèves, son personnel et ses données."],
  ["deleteSchoolConfirm", "سيتمّ حذف «{name}» وكل بياناتها نهائيًا. لا يمكن التراجع.", "“{name}” and all its data will be permanently deleted. This can’t be undone.", "« {name} » et toutes ses données seront définitivement supprimées. Action irréversible."],

  ["usageTitle", "الاستخدام", "Usage", "Utilisation"],
  ["usageIntro", "عدّادات مجهولة الهوية لكل المنصّة.", "Anonymous counters across the platform.", "Compteurs anonymes de toute la plateforme."],
  ["totalSchools", "المدارس", "Schools", "Écoles"],
  ["daily", "النشاط اليومي", "Daily activity", "Activité quotidienne"],

  ["auditTitle", "سجلّ النشاط", "Audit log", "Journal d’activité"],
  ["auditIntro", "كل التغييرات الحسّاسة على المنصّة.", "Every sensitive change on the platform.", "Toutes les modifications sensibles de la plateforme."],
  ["filter", "تصفية…", "Filter…", "Filtrer…"],

  ["errorsTitle", "تقارير الأخطاء", "Error reports", "Rapports d’erreurs"],
  ["errorsIntro", "أخطاء التطبيق المُرسلة تلقائيًا من المتصفّحات.", "App errors reported automatically by browsers.", "Erreurs signalées automatiquement par les navigateurs."],
  ["errorsEmpty", "لا توجد أخطاء.", "No errors reported.", "Aucune erreur signalée."],
  ["occurrences", "{count} مرّة", "{count}×", "{count} fois"],
  ["stack", "تفاصيل تقنية", "Stack trace", "Trace technique"],
  ["refresh", "تحديث", "Refresh", "Actualiser"]
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

export const admin: NamespaceMessages = build(ROWS);

// Lightweight i18n: English strings are the keys. Missing Arabic strings fall back to English.
export type Lang = "en" | "ar";

const ar: Record<string, string> = {
  Dashboard: "لوحة التحكم", Tasks: "المهام", Habits: "العادات", "Daily Challenge": "التحدي اليومي", "Focus Room": "غرفة التركيز", "Life Goals": "أهداف الحياة",
  "Memory Vault": "خزنة الذكريات", "Achievement Journey": "رحلة الإنجازات", "Weekly Review": "المراجعة الأسبوعية", Calendar: "التقويم", Analytics: "التحليلات",
  "Music Hub": "مركز الموسيقى", "Theme Studio": "استوديو المظهر", Settings: "الإعدادات", Profile: "الملف الشخصي", More: "المزيد", Home: "الرئيسية",
  "Good morning": "صباح الخير", "Good afternoon": "مساء الخير", "Good evening": "مساء الخير", "Sign out": "تسجيل الخروج", "Sign in": "تسجيل الدخول",
  "Sign up": "إنشاء حساب", Save: "حفظ", Cancel: "إلغاء", Delete: "حذف", Edit: "تعديل", Create: "إنشاء", "Create Task": "إنشاء مهمة", "Add Habit": "إضافة عادة",
  "Start Focus": "ابدأ التركيز", "Create Note": "إنشاء ملاحظة", "Add Goal": "إضافة هدف", "Quick actions": "إجراءات سريعة", "Today's progress": "تقدم اليوم",
  "Completed tasks": "المهام المكتملة", Remaining: "المتبقي", "Current streak": "السلسلة الحالية", "Focus time": "وقت التركيز", Search: "بحث", Language: "اللغة",
  "Exit Demo": "الخروج من العرض", "DEMO MODE": "وضع العرض", "Create free account": "أنشئ حساباً مجانياً", "Edit Profile": "تعديل الملف", "Change Picture": "تغيير الصورة",
  "Display name": "الاسم المعروض", Email: "البريد الإلكتروني", Password: "كلمة المرور", Appearance: "المظهر", Notifications: "الإشعارات", Timezone: "المنطقة الزمنية",
  "Upcoming reminders": "التذكيرات القادمة", "Recent achievements": "أحدث الإنجازات", "Weekly summary": "ملخص الأسبوع", "Account": "الحساب", "Today": "اليوم",
  "Your Life. Your Goals. Your Progress.": "حياتك. أهدافك. تقدمك.",
};

export function translate(lang: Lang, s: string): string {
  return lang === "ar" ? ar[s] ?? s : s;
}

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
  "Theme sections": "أقسام المظهر", "Presets": "قوالب جاهزة", "Color": "الألوان", "Glass": "الزجاج", "Background": "الخلفية", "Gradients": "التدرجات", "Interface": "الواجهة", "My themes": "مظاهري", "Fonts": "الخطوط", "Font library": "مكتبة الخطوط", "Font selection": "اختيار الخط", "Live preview": "معاينة مباشرة", "Apply Theme": "تطبيق المظهر", "Reset Theme": "إعادة ضبط المظهر", "Discard": "تجاهل", "Language updated": "تم تحديث اللغة", "English": "الإنجليزية", "Arabic": "العربية", "Search or jump to…": "ابحث أو انتقل إلى…", "Command menu": "قائمة الأوامر", "Mark all read": "تحديد الكل كمقروء", "You're all caught up.": "مفيش إشعارات جديدة.", "No results": "مفيش نتائج", "Collapse": "طيّ القائمة", "Good morning": "صباح الفل", "Good afternoon": "نهارك سعيد", "Good evening": "مساء الخير", "Welcome back,": "نورت تاني،", "Today's progress": "إنجازك النهارده", "Quick actions": "اختصارات سريعة", "Upcoming reminders": "التذكيرات الجاية", "Recent achievements": "آخر الإنجازات", "Weekly summary": "ملخص الأسبوع", "Focus": "تركيز", "Notifications": "الإشعارات", "Timezone": "المنطقة الزمنية", "Appearance": "المظهر", "Account preferences": "تفضيلات الحساب", "Daily productivity goal (points)": "هدف الإنتاجية اليومي (نقاط)", "Change Name": "تغيير الاسم", "Change Picture": "تغيير الصورة", "Edit Profile": "تعديل الملف الشخصي", "Member since": "عضو من", "Display name": "الاسم المعروض", "Email": "البريد الإلكتروني", "Verified": "تم التحقق", "Unverified": "لم يتم التحقق", "Save picture": "حفظ الصورة", "Choose picture": "اختيار صورة", "Replace picture": "استبدال الصورة", "Remove": "إزالة", "Cancel": "إلغاء", "Save": "حفظ", "Delete": "حذف", "Edit": "تعديل", "Create": "إنشاء", "Search": "بحث", "More": "المزيد", "Account": "الحساب", "Sign out": "تسجيل الخروج",
};

export function translate(lang: Lang, s: string): string {
  return lang === "ar" ? ar[s] ?? s : s;
}

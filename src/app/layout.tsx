import type { Metadata, Viewport } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customFonts } from "@/db/schema";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { Backdrop } from "@/components/effects";
import { getSessionUser, publicUser } from "@/lib/server/auth";
import { DEFAULT_PREFS, parsePrefs } from "@/lib/prefs";

export async function generateMetadata(): Promise<Metadata> {
  const u = await getSessionUser();
  const requestHeaders = await headers();
  const preferredLanguage = requestHeaders.get("accept-language") ?? "";
  const ar = u?.language === "ar" || (!u && /^ar(?:-|,|;|$)/i.test(preferredLanguage));
  return {
    title: { default: "Ukiyo", template: "%s · Ukiyo" },
    description: ar
      ? "مساحة شخصية لتنظيم المهام والعادات والأهداف والتركيز ومتابعة التقدم."
      : "A personal space for tasks, habits, goals, focus and progress.",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icon.svg" },
  };
}
export const viewport: Viewport = { themeColor: "#0b0b10", viewportFit: "cover", width: "device-width", initialScale: 1 };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playpen+Sans+Arabic:wght@400;500;600;700&family=Sniglet:wght@400;800&family=Kavoon&family=Merienda:wght@400;500;600;700&family=Shantell+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Cairo:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&family=Noto+Naskh+Arabic:wght@400;600&display=swap";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const u = await getSessionUser();
  const requestHeaders = await headers();
  const preferredLanguage = requestHeaders.get("accept-language") ?? "";
  const initialLang = u?.language === "ar" ? "ar" : u?.language === "en" ? "en" : /^ar(?:-|,|;|$)/i.test(preferredLanguage) ? "ar" : "en";
  const prefs = u ? parsePrefs(u.preferences) : DEFAULT_PREFS;
  const th = prefs.theme;
  const [customFont] = u && th.font === "custom"
    ? await db.select({ userId: customFonts.userId }).from(customFonts).where(eq(customFonts.userId, u.id)).limit(1)
    : [];
  const lang = initialLang;
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-mode={th.mode === "light" ? "light" : "dark"} data-mode-setting={th.mode} data-motion={th.reducedMotion || th.animation === 0 ? "off" : "on"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        {customFont && <style>{`@font-face{font-family:"UkiyoCustom";src:url("/api/me/font");font-style:normal;font-weight:100 900;font-display:swap;}`}</style>}
        <script dangerouslySetInnerHTML={{ __html: `try{var d=document.documentElement;if(d.dataset.modeSetting==='system'){d.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}` }} />
      </head>
      <body>
        <AppProvider initialUser={u ? publicUser(u) : null} initialPrefs={prefs} initialLang={initialLang}>
          <Backdrop />
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-[var(--on-accent)]">
            {lang === "ar" ? "تخطي إلى المحتوى" : "Skip to content"}
          </a>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

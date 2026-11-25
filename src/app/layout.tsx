import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { Backdrop } from "@/components/effects";
import { getSessionUser, publicUser } from "@/lib/server/auth";
import { DEFAULT_PREFS, parsePrefs } from "@/lib/prefs";

export const metadata: Metadata = {
  title: { default: "LIFE OS — Your Life. Your Goals. Your Progress.", template: "%s · LIFE OS" },
  description: "A premium personal operating system for tasks, habits, goals, focus and progress.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#0b0b10", viewportFit: "cover", width: "device-width", initialScale: 1 };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&family=Noto+Naskh+Arabic:wght@400;600&display=swap";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const u = await getSessionUser();
  const prefs = u ? parsePrefs(u.preferences) : DEFAULT_PREFS;
  const th = prefs.theme;
  const lang = u?.language === "ar" ? "ar" : "en";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-mode={th.mode === "light" ? "light" : "dark"} data-mode-setting={th.mode} data-motion={th.reducedMotion || th.animation === 0 ? "off" : "on"} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
        <script dangerouslySetInnerHTML={{ __html: `try{var d=document.documentElement;if(d.dataset.modeSetting==='system'){d.dataset.mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}` }} />
      </head>
      <body>
        <AppProvider initialUser={u ? publicUser(u) : null} initialPrefs={prefs}>
          <Backdrop />
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-[var(--on-accent)]">
            Skip to content
          </a>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

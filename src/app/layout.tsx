import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import Sidebar from "@/components/sidebar";
import CelebrationEngine from "@/components/game/celebration-engine";
import Toaster from "@/components/game/toaster";
import PwaRegister from "@/components/pwa-register";
import FloatingAssistant from "@/components/assistant/floating";
import { getGameState } from "@/lib/gamification";
import "./globals.css";

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const data = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  applicationName: "HQ",
  title: "HQ",
  description: "Your personal HQ — applications, work, reflections, people, gym and more.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HQ", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const game = await getGameState();
  const xpPct = game.xpForLevel ? Math.min(100, Math.round((game.xpIntoLevel / game.xpForLevel) * 100)) : 100;

  // set stored theme before paint to avoid a flash; no choice → CSS follows the OS
  const themeInit = `(function(){try{var t=localStorage.getItem('hq-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${data.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full lg:flex bg-bg text-ink">
        <Sidebar level={game.level} levelName={game.levelName} xpPct={xpPct} />
        <main className="flex-1 min-w-0">{children}</main>
        <CelebrationEngine state={game} />
        <Toaster />
        <PwaRegister />
        <FloatingAssistant />
      </body>
    </html>
  );
}

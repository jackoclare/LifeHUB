import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Inter_Tight({ subsets: ["latin"], variable: "--font-heading", display: "swap", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "MyLife Hub", template: "%s · MyLife Hub" },
  description: "Jack's personal hub — bills, calendar, travel, sport, deals and health in one place.",
  applicationName: "MyLife Hub",
  appleWebApp: { capable: true, title: "MyLife", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false }, // private app — keep out of Google
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
  ],
};

// Runs before the page paints so the theme never flashes the wrong colour.
const themeScript = `(function(){try{var t=localStorage.getItem('mlh.theme')||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark'}requestAnimationFrame(function(){document.documentElement.classList.add('theme-ready')})})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-theme="dark" suppressHydrationWarning className={`${body.variable} ${heading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

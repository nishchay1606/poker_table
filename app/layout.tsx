import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { NotConfigured } from "@/components/NotConfigured";
import { ToastProvider } from "@/components/Toast";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poker Home Game Tracker",
  description: "Track buy-ins, cash-outs and results for your home poker games.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isSupabaseConfigured ? (
          <ToastProvider>
            <NavBar />
            <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">{children}</main>
          </ToastProvider>
        ) : (
          <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">
            <NotConfigured />
          </main>
        )}
      </body>
    </html>
  );
}

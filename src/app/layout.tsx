import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "./_components/AuthStatus";
import ThemeToggle from "./_components/ThemeToggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme.ts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ISMS-P 스터디 까페",
  description: "ISMS-P 인증 심사 전문가 자격을 함께 공부하는 온라인 스터디 까페",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // data-theme은 아래 스크립트가 하이드레이션 전에 붙이므로 서버 HTML과 다를 수 있다.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col"><header className="flex items-center justify-end gap-2 p-4">
          <ThemeToggle />
          <Suspense fallback={null}>
            <AuthStatus />
          </Suspense>
        </header>
        {children}
        <footer className="p-4 text-center text-sm">
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
        </footer>
      </body>
    </html>
  );
}

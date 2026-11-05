import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import AuthStatus from "./_components/AuthStatus";
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
    >
      <body className="min-h-full flex flex-col"><header className="flex justify-end p-4">
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

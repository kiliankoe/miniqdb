import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "@/app/(main)/ClientLayout";
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
  title: process.env.MINIQDB_NAME === "" ? "miniqdb" : process.env.MINIQDB_NAME,
  description: "quote database",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <ClientLayout>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased p-6 dark:bg-zinc-900 dark:text-white h-full`}
        >
          {children}
        </body>
      </ClientLayout>
    </html>
  );
}

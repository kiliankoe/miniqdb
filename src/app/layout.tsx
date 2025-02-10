import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "qdb",
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
          className={`${geistSans.variable} ${geistMono.variable} antialiased m-6 dark:bg-zinc-900 dark:text-white`}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-orange-500">bash</h1>
            {/* <Link href="/rss">rss</Link> */}
          </div>
          <nav className="mb-6 space-x-2 text-sm font-semibold underline">
            <Link href="/">new</Link>
            <Link href="/?sort=top">top</Link>
            <Link href="/new">new</Link>
          </nav>
          {children}
        </body>
      </ClientLayout>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import Navigation from "./Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "miniqdb",
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
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-orange-500">{process.env.MINIQDB_NAME ?? "miniqdb"}</h1>
            {/* <Link href="/rss">rss</Link> */}
          </div>
          <Navigation />
          {children}
        </body>
      </ClientLayout>
    </html>
  );
}

import ClientLayout from "@/app/(main)/ClientLayout";
import type { Metadata } from "next";
import "./globals.css";

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
          style={{
            padding: "24px",
            height: "100%",
          }}
        >
          {children}
        </body>
      </ClientLayout>
    </html>
  );
}

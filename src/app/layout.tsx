import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    process.env.NEXT_PUBLIC_MINIQDB_NAME === ""
      ? "miniqdb"
      : process.env.NEXT_PUBLIC_MINIQDB_NAME,
  description: "quote database",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          padding: "24px",
          height: "100%",
        }}
      >
        {children}
      </body>
    </html>
  );
}

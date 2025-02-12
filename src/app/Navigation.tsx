"use client";

import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="mb-6 space-x-2 text-sm font-semibold underline">
      <Link href="/">new</Link>
      <Link href="/?sort=top">top</Link>
      <Link href="/?sort=random" onClick={() => {
        if (window.location.search === "?sort=random") {
          window.location.reload();
        }
      }}>random</Link>
      <Link href="/submit">submit</Link>
    </nav>
  )
}

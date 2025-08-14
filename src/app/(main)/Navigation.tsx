"use client";

import { useIsAdmin } from "@/hooks/useIsAdmin";
import Link from "next/link";
import styles from "./Navigation.module.css";

export default function Navigation() {
  const { isAdmin } = useIsAdmin();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.link}>
        #new
      </Link>
      <Link href="/?sort=top" className={styles.link}>
        #top
      </Link>
      <Link
        href="/?sort=random"
        className={styles.link}
        onClick={() => {
          if (window.location.search === "?sort=random") {
            window.location.reload();
          }
        }}
      >
        #random
      </Link>
      <Link href="/search" className={styles.link}>
        #search
      </Link>
      <Link href="/submit" className={styles.link}>
        #submit
      </Link>
      {isAdmin && (
        <Link href="/admin" className={styles.link}>
          #admin
        </Link>
      )}
    </nav>
  );
}

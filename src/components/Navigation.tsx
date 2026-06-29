import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/lib/queries";
import { getPb } from "@/lib/pocketbase";
import styles from "./Navigation.module.css";

export function Navigation() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLogout = () => {
    getPb().authStore.clear();
    queryClient.clear();
    navigate({ to: "/login" });
  };

  return (
    <nav className={styles.nav}>
      <Link to="/" search={{ sort: "newest" }} className={styles.link}>
        #latest
      </Link>
      <Link to="/" search={{ sort: "top" }} className={styles.link}>
        #top
      </Link>
      <Link
        to="/"
        search={{ sort: "random" }}
        className={styles.link}
        onClick={() => {
          if (window.location.search === "?sort=random") {
            window.location.reload();
          }
        }}
      >
        #random
      </Link>
      <Link to="/search" className={styles.link}>
        #search
      </Link>
      <Link to="/submit" className={styles.link}>
        #submit
      </Link>
      {isAdmin && (
        <Link to="/admin" className={styles.link}>
          #admin
        </Link>
      )}
      <button
        type="button"
        onClick={handleLogout}
        className={styles.link}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          font: "inherit",
          cursor: "pointer",
        }}
      >
        #logout
      </button>
    </nav>
  );
}

import styles from "./Loading.module.css";

export function Loading() {
  return (
    <main className={styles.main}>
      <div className={styles.spinner} />
    </main>
  );
}

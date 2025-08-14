import { useEffect, useState } from "react";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/admin")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.isAdmin);
        setIsLoading(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setIsLoading(false);
      });
  }, []);

  return { isAdmin, isLoading };
}

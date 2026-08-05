import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { getConfig } from "@/lib/config";
import { getPb } from "@/lib/pocketbase";
import { subscribeToRealtime } from "@/lib/realtime";

// Tokens last 180 days (migration 4); refreshing once per app load slides
// that window so active users never hit the OTP prompt again.
let refreshAttempted = false;

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    const pb = getPb();
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login" });
    }
    if (!refreshAttempted) {
      refreshAttempted = true;
      pb.collection("users")
        .authRefresh()
        .catch((err) => {
          // Only log out on a rejected token; network hiccups shouldn't.
          if (err?.status === 401 || err?.status === 403) {
            pb.authStore.clear();
          }
        });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const config = getConfig();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribeToRealtime(queryClient);
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    return getPb().authStore.onChange(() => {
      queryClient.invalidateQueries();
    });
  }, [queryClient]);

  return (
    <>
      <Header appName={config.appName} />
      <Outlet />
    </>
  );
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { getConfig } from "@/lib/config";
import { getPb } from "@/lib/pocketbase";
import { subscribeToRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    const pb = getPb();
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login" });
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

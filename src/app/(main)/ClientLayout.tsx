"use client";

import { createTheme, CssBaseline, useMediaQuery } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useMemo } from "react";
import Header from "./Header";

const queryClient = new QueryClient();

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)", {
    noSsr: true,
    defaultMatches: false,
  });

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode],
  );

  const appName = process.env.NEXT_PUBLIC_MINIQDB_NAME || "miniqdb";

  return (
    <SessionProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <Header appName={appName} />
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

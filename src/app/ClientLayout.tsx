"use client";

import { ThemeProvider } from "@mui/material/styles";
import { createTheme, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useMemo, useState, useEffect } from "react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();

  const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [mode, setMode] = useState<"light" | "dark">(prefersDarkMode ? "dark" : "light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
      }),
    [mode]
  );

  return (
    <SessionProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { CssBaseline, createTheme, useMediaQuery } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import type { QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  );
}

"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const theme = createTheme({
  palette: {
    primary: {
      main: "#fb923c",
      dark: "#f97316",
      contrastText: "#242105",
    },
    upvote: {
      main: "#fb923c",
      dark: "#f97316",
      contrastText: "#242105",
    },
    downvote: {
      main: "#c084fc",
      dark: "#a855f7",
      contrastText: "#242105",
    },
  },
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

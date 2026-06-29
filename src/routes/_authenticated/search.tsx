import { createFileRoute } from "@tanstack/react-router";
import { useSearchQuotes, useIsAdmin } from "@/lib/queries";
import { QuoteView } from "@/components/QuoteView";
import useDebounce from "@/hooks/useDebounce";
import { Box, CircularProgress, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import type { QuoteWithVote } from "@/lib/types";
import { useEffect, useState } from "react";

interface SearchParams {
  q?: string;
}

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: search.q ? String(search.q) : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQuery = "" } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const { data: isAdmin } = useIsAdmin();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentQ = params.get("q") || "";
    if (currentQ === debouncedSearchQuery) return;
    if (debouncedSearchQuery) {
      params.set("q", debouncedSearchQuery);
    } else {
      params.delete("q");
    }
    const newUrl = `/search?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedSearchQuery]);

  const {
    data: quotes,
    isLoading,
    error,
  } = useSearchQuotes(debouncedSearchQuery);

  return (
    <Box>
      <TextField
        fullWidth
        placeholder="Search quotes"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          mb: 4,
          "& .MuiOutlinedInput-root": {
            "&.Mui-focused fieldset": {
              borderColor: orange[700],
            },
          },
        }}
      />

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          Failed to search quotes. Please try again.
        </Typography>
      )}

      {!isLoading &&
        !error &&
        (!quotes || quotes.length === 0) &&
        debouncedSearchQuery.trim() !== "" && (
          <Typography sx={{ my: 2 }}>
            No quotes found matching your search.
          </Typography>
        )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {quotes?.map((quote: QuoteWithVote) => (
          <QuoteView key={quote.id} quote={quote} isAdmin={isAdmin} />
        ))}
      </Box>
    </Box>
  );
}

"use client";

import { Box, TextField, Typography, CircularProgress } from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useDebounce from "@/hooks/useDebounce";
import { QuoteView } from "@/shared/QuoteView";
import type { QuoteResponse } from "@/app/api/quotes/QuoteResponse";
import { orange } from "@mui/material/colors";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const { data, isLoading, error } = useQuery({
    queryKey: ["quotes", "search", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery.trim()) {
        return { quotes: [], isAdmin: false };
      }

      const response = await fetch(
        `/api/quotes/search?q=${encodeURIComponent(debouncedSearchQuery)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch quotes");
      }

      return response.json();
    },
    enabled: debouncedSearchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const quotes = data?.quotes || [];
  const isAdmin = data?.isAdmin || false;

  return (
    <Box>
      <TextField
        fullWidth
        placeholder="Search quotes"
        // color="secondary"
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
        quotes.length === 0 &&
        debouncedSearchQuery.trim() !== "" && (
          <Typography sx={{ my: 2 }}>
            No quotes found matching your search.
          </Typography>
        )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {quotes.map((quote: QuoteResponse) => (
          <QuoteView key={quote.id} quote={quote} isAdmin={isAdmin} />
        ))}
      </Box>
    </Box>
  );
}

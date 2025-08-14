"use client";

import type {
  QuoteResponse,
  QuotesResponse,
} from "@/app/api/quotes/QuoteResponse";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, Typography } from "@mui/material";
import { blue, orange } from "@mui/material/colors";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function VoteView({
  score,
  vote,
  quoteId,
}: {
  score: number;
  vote?: number;
  quoteId: number;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newVote: number) => {
      const response = await fetch(`/api/quotes/${quoteId}/vote`, {
        method: "PUT",
        body: JSON.stringify({ vote: newVote }),
      });
      if (!response.ok) {
        throw new Error("Failed to update vote");
      }
      return response.json();
    },
    onMutate: async (newVote: number) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["quotes"] });
      await queryClient.cancelQueries({ queryKey: ["quote", String(quoteId)] });

      // Store all previous states
      const previousStates: Array<{ queryKey: any; data: any }> = [];

      // Update single quote cache for quote detail page
      const singleQuoteKey = ["quote", String(quoteId)];
      const singleQuoteData = queryClient.getQueryData<{
        quote: QuoteResponse;
        isAdmin: boolean;
      }>(singleQuoteKey);

      if (singleQuoteData?.quote) {
        previousStates.push({
          queryKey: singleQuoteKey,
          data: singleQuoteData,
        });

        queryClient.setQueryData<{ quote: QuoteResponse; isAdmin: boolean }>(
          singleQuoteKey,
          (old) => {
            if (!old?.quote) return old;

            return {
              ...old,
              quote: {
                ...old.quote,
                score: old.quote.score + (newVote - (vote ?? 0)),
                vote: newVote,
              },
            };
          },
        );
      }

      // Update all cached quote lists that might contain this quote
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quotes"] })
        .forEach((query) => {
          const queryKey = query.queryKey;
          const currentData =
            queryClient.getQueryData<QuotesResponse>(queryKey);

          if (currentData?.quotes) {
            previousStates.push({ queryKey, data: currentData });

            // Optimistically update the cache without invalidating
            queryClient.setQueryData<QuotesResponse>(queryKey, (old) => {
              if (!old?.quotes) return old;

              const newQuotes = old.quotes.map((quote: QuoteResponse) => {
                if (quote.id === quoteId) {
                  return {
                    ...quote,
                    score: quote.score + (newVote - (vote ?? 0)),
                    vote: newVote,
                  };
                }
                return quote;
              });
              return { ...old, quotes: newQuotes };
            });
          }
        });

      return { previousStates };
    },
    onError: (err, newVote, context) => {
      // Restore all previous states on error
      if (context?.previousStates) {
        context.previousStates.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      // Update was successful, the optimistic updates remain
      // Don't invalidate queries - just let the optimistic updates stand
    },
  });

  const handleVote = (newVote: number) => {
    mutation.mutate(newVote);
  };

  const getVoteColor = (voteValue: number | undefined) => {
    if (voteValue === 1) return orange[400];
    if (voteValue === -1) return blue[400];
    return "text.secondary";
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="center"
    >
      <IconButton
        onClick={() => handleVote(vote === 1 ? 0 : 1)}
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: getVoteColor(vote === 1 ? 1 : undefined),
          },
        }}
      >
        <ExpandLessIcon />
      </IconButton>
      <Typography
        variant="body1"
        sx={{ fontFamily: "monospace", width: "25px", textAlign: "center" }}
      >
        {score}
      </Typography>
      <IconButton
        onClick={() => handleVote(vote === -1 ? 0 : -1)}
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: getVoteColor(vote === -1 ? -1 : undefined),
          },
        }}
      >
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  );
}

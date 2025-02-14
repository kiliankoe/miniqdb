"use client";

import type { QuoteResponse, QuotesResponse } from "@/app/api/quotes/QuoteResponse";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, Typography } from "@mui/material";
import { blue, orange } from "@mui/material/colors";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import React from "react";

export function VoteView({ score, vote, quoteId }: { score: number; vote?: number; quoteId: number }) {
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

      // Change undefined to null when getting previous data
      const previousQuotes = queryClient.getQueryData<QuotesResponse>(["quotes"]) ?? null;

      // Optimistically update to the new value
      queryClient.setQueryData<QuotesResponse>(["quotes"], (old) => {
        if (!old?.quotes) return old;

        const newQuotes = old.quotes.map((quote: QuoteResponse) => {
          if (quote.id === quoteId) {
            return { ...quote, score: quote.score + (newVote - (vote ?? 0)), vote: newVote };
          }
          return quote;
        });
        return { ...old, quotes: newQuotes };
      });

      return { previousQuotes };
    },
    onError: (err, newVote, context) => {
      if (context) {
        queryClient.setQueryData(["quotes"], context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
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
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
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
      <Typography variant="body1" sx={{ fontFamily: "monospace", width: "25px", textAlign: "center" }}>
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

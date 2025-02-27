import type { QuoteResponse } from "@/app/api/quotes/QuoteResponse";
import { Stack, Typography } from "@mui/material";
import Link from "next/link";
import React from "react";
import { VoteView } from "./VoteView";

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      return (
        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return segment;
  });
}

export function QuoteView({ quote }: { quote: QuoteResponse }) {
  const createdAt = new Date(quote.createdAt);

  return (
    <Stack
      direction="column"
      spacing={0}
      maxWidth={{
        xs: '100%',
        sm: '90%',
        md: '80%'
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Link href={`/${quote.id}`}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: "monospace",
              textDecoration: "none",
              textUnderlineOffset: 1,
              textDecorationColor: "white",
            }}
          >
            {createdAt.toLocaleString("de-DE", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
            })}
          </Typography>
        </Link>
        <VoteView score={quote.score} vote={quote.vote} quoteId={quote.id} />
      </Stack>
      <div>
        {quote.text?.split("\n").map((line, i) => (
          <React.Fragment key={i}>
            {parseMarkdownLinks(line)}
            <br />
          </React.Fragment>
        ))}
      </div>
    </Stack>
  );
}

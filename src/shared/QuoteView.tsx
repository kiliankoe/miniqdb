import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, Typography } from "@mui/material";
import type { Quote } from "@prisma/client";
import Link from "next/link";
import React from "react";

// This is such a hack lol, but I want to keep the generated data type.
export type ClientQuote = Pick<Quote, "id" | "text"> & {
  // Unfortunately these don't survive json serialization
  createdAt: string;
  score: number;
};

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      return (
        <a key={j} href={url} className="underline" target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return segment;
  });
}

export function QuoteView({ quote }: { quote: ClientQuote }) {
  const createdAt = new Date(quote.createdAt);

  return (
    <Stack direction="column" spacing={0}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Link href={`/${quote.id}`}>
          <Typography
            variant="body2"
            sx={{ fontFamily: "monospace", textDecoration: "underline", textUnderlineOffset: 1 }}
            color="text.secondary"
          >
            {createdAt.toLocaleString("de-DE", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
            })}
          </Typography>
        </Link>
        <VoteView score={quote.score} />
      </Stack>
      <div>
        {quote.text?.split("\\n").map((line, i) => (
          <React.Fragment key={i}>
            {parseMarkdownLinks(line)}
            <br />
          </React.Fragment>
        ))}
      </div>
    </Stack>
  );
}

function VoteView({
  score,
  isUpvoted = false,
  isDownvoted = false,
}: {
  score: number;
  isUpvoted?: boolean;
  isDownvoted?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <IconButton color={isUpvoted ? "upvote" : "default"} size="small">
        <ExpandLessIcon />
      </IconButton>
      <Typography variant="body1" sx={{ fontFamily: "monospace" }}>
        {score}
      </Typography>
      <IconButton color={isDownvoted ? "downvote" : "default"} size="small">
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  );
}
